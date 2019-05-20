import { DockerImageBuilder } from '../resources/DockerImageBuilder'
import { logHandler } from '../utils/Logging'
import { NextFunction, Request, Response } from 'express'
import { Readable } from 'stream'
import { Router } from 'express'
import Busboy from 'busboy'
import fs from 'fs'
import path from 'path'
import rimraf from 'rimraf'
import unzipper from 'unzipper'

interface BuildConfig {
  projectDir: string
  functionName: string
  lang: string
  gpuCapable: Boolean
  handler: string
  username: string
}

interface BuildRequest extends Request {
  buildConfig: BuildConfig
  imagesToBuild: DockerImageBuilder[]
  filesToDeleteOnEnd: string[]
  imagesToDeleteOnEnd: string[]
}

const getProjectZip = (logger: any, req: BuildRequest, next: NextFunction) => (
  field: string,
  file: Readable,
  filename: string,
  encoding: string,
  mimetype: string
) => {
  if (field != 'project' || mimetype != 'application/zip') {
    file.resume()
  }

  logger.info('Save file', { field, filename, encoding, mimetype })
  const savePath = path.join('/app', '/tmp', filename.split('.')[0])

  req.buildConfig = {
    projectDir: savePath,
    ...req.buildConfig,
  }

  const extractStream = unzipper.Extract({ path: savePath })
  extractStream.on('error', (err: Error) => {
    if (err) {
      logger.error('Error unzipping', err)
      throw err
    }
  })

  extractStream.on('close', () => {
    logger.info('File extraction succeeded', { path: savePath })
    next()
  })

  file.pipe(extractStream)
}

const saveFile = (logger: any, req: BuildRequest, _: Response, next: NextFunction) => {
  const busboy = new Busboy({ headers: req.headers })
  busboy.on('file', getProjectZip(logger, req, next))
  busboy.on('finish', () => logger.info('File uploaded by busboy'))
  req.pipe(busboy)
}

const parseHermesConfig = (logger: any, req: BuildRequest, res: Response, next: NextFunction) => {
  try {
    const hermesConfig = JSON.parse(
      fs.readFileSync(req.buildConfig.projectDir + '/hermes.config.json', { encoding: 'utf-8' })
    )

    const { functionName, lang, handler } = hermesConfig
    req.buildConfig = {
      username: 'hermes-function',
      functionName,
      lang,
      handler,
      gpuCapable: lang === 'cuda',
      ...req.buildConfig,
    }

    next()
  } catch (e) {
    logger.error('Error parsing hermes config json', { error: e })
    res.status(400).send('Error on hermes.config.json')

    throw e
  }
}

const prepareImagesToBuild = async (logger: any, req: BuildRequest, res: Response, next: NextFunction) => {
  const { username, functionName, lang, projectDir, handler } = req.buildConfig

  logger.info('Query string', req.query)
  req.imagesToBuild = []

  const projectBuilderImage = username.toLowerCase() + '/' + functionName.toLowerCase() + '_builder'
  req.imagesToBuild.push(
    new DockerImageBuilder(logger, {
      dockerfilePath: `/app/ProjectBuilderImages/${lang}.Dockerfile`,
      imageName: projectBuilderImage,
      buildContext: projectDir,
    })
  )

  if (req.query['function-watcher']) {
    const functionWatcherBase = `function_watcher_${lang}_base`
    req.imagesToBuild.push(
      new DockerImageBuilder(logger, {
        dockerfilePath: `/app/functionWatcher/baseImages/${lang}.Dockerfile`,
        imageName: functionWatcherBase,
        buildContext: `/app/functionWatcher`,
      })
    )

    req.imagesToBuild.push(
      new DockerImageBuilder(logger, {
        dockerfilePath: '/app/functionWatcher/Dockerfile',
        imageName: username.toLowerCase() + '/' + functionName.toLowerCase() + '_watcher',
        buildArgs: [`FUNCTION_BUILDER_IMAGE=${projectBuilderImage}`, `FUNCTION_WATCHER_BASE=${functionWatcherBase}`],
        buildContext: `/app/functionWatcher`,
      })
    )
  }

  next()
}

const buildImages = async (logger: any, req: BuildRequest, res: Response, next: NextFunction) => {
  const { imagesToBuild: images } = req

  for (let i = 0; i < images.length; i++) {
    let stdout = ''
    images[i].build().on('data', data => (stdout += data))
    await images[i].getExitCode()
    const output = {
      imageName: images[i].imageName,
      stdout,
      stderr: await images[i].getStdErr(),
      returnCode: await images[i].getExitCode(),
    }

    if (output.returnCode != 0) throw new Error(output.stdout + '\n=============\n' + output.stderr)

    res.write(output.stdout)
    logger.info('Build image', output)
  }

  res.status(200).end()

  // next()
}

const clearFiles = (logger: any, req: BuildRequest) => {
  const { projectDir } = req.buildConfig
  rimraf(projectDir, (e: Error) => {
    if (e) {
      logger.error('rimraf error', { projectDir, error: e })
      throw e
    } else logger.info('Files uploaded were deleted', { projectDir })
  })
}

const getBuildRouter = (logger: any) => {
  const buildRoute = Router()
  const logHandlerWithLogger = logHandler(logger)
  buildRoute.post(
    '/',
    [
      { handler: saveFile, handlerName: 'saveFile' },
      { handler: parseHermesConfig, handlerName: 'parseHermesConfig' },
      { handler: prepareImagesToBuild, handlerName: 'prepareImagesToBuild' },
      { handler: buildImages, handlerName: 'buildImages' },
      // { handler: clearFiles, handlerName: 'clearFiles' },
    ].map(logHandlerWithLogger)
  )

  return buildRoute
}

export { getBuildRouter }
