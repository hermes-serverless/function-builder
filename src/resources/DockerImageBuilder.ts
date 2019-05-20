import { Subprocess } from './Subprocess'

class DockerImageBuilder {
  buildArgs?: string[]
  buildContext: string
  containerRuntime: string
  dockerfilePath: string
  imageName: string
  logger: any
  dockerProc: Subprocess

  constructor(
    logger: any,
    { imageName, dockerfilePath, buildArgs, buildContext, containerRuntime }: any
  ) {
    this.logger = logger
    this.imageName = imageName
    this.dockerfilePath = dockerfilePath
    this.buildArgs = buildArgs || []
    this.buildContext = buildContext
    this.containerRuntime = containerRuntime
  }

  public build() {
    this.dockerProc = new Subprocess(this.logger, {
      path: '/usr/local/bin/docker',
      args: this.createBuildArgs(),
    })

    return this.dockerProc.start()
  }

  public getExitCode() {
    return this.dockerProc.exitCode()
  }

  public getStdErr() {
    return this.dockerProc.getStdErr()
  }

  private createBuildArgs() {
    let args = ['build']
    args = args.concat(['-t', this.imageName])
    this.buildArgs &&
      this.buildArgs.forEach((buildArg: string) => {
        args = args.concat(['--build-arg', buildArg])
      })
    args = args.concat(['-f', this.dockerfilePath])
    args.push(this.buildContext)

    this.logger.info(`Build args`, { args })
    return args
  }
}

export { DockerImageBuilder }
