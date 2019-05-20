import { createLogger, format, transports } from 'winston'
import { forEachObjIndexed } from 'ramda'
import { Request, Response, NextFunction } from 'express'
import { TransformableInfo } from 'logform'
import colors from 'colors/safe'

const logHandler = (logger: any) => ({
  handler,
  handlerName,
}: {
  handler: Function
  handlerName: string
}) => (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()

  try {
    handler(logger, req, res, next)
    logger.info('Incoming request', {
      method: req.method,
      originalUrl: req.originalUrl,
      handlerName,
      totalTime: `${Date.now() - start} ms`,
    })
  } catch (e) {
    logger.error('Incoming request', {
      method: req.method,
      originalUrl: req.originalUrl,
      handlerName,
      totalTime: `${Date.now() - start} ms`,
      error: e,
    })
  }
}

colors.enable()
const myFormat = format.combine(
  format.timestamp({
    format: 'DD/MM HH:mm:ss',
  }),
  format.printf((info: TransformableInfo) => {
    const { timestamp, message, level, ...remains } = info
    const levelColor: { [key: string]: string } = {
      info: 'green',
      error: 'red',
    }

    // @ts-ignore
    const baseStr = colors.blue(`${timestamp} `) + colors[levelColor[level]](`[${level}] `)
    const rawBaseStr = `${timestamp} ` + `[${level}] `

    let remainsStr = ''
    forEachObjIndexed((val, key) => {
      remainsStr += '\n' + ' '.repeat(rawBaseStr.length) + colors.bold(`${key}: `) + `${val}`
    }, remains)

    return baseStr + colors.bold(message) + remainsStr
  })
)

const logger = createLogger({
  format: myFormat,
  transports: [new transports.Console()],
})

export { logHandler, logger }
