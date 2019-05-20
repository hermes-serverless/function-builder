import { spawn, ChildProcess } from 'child_process'
import { Readable } from 'stream'

class Subprocess {
  logger: any
  path: string
  args: string[]
  process: ChildProcess
  stderrOutput: string
  resolveReturnCode: any
  returnCode: Promise<number>
  inputStream?: Readable

  constructor(logger: any, { path, args, inputStream }: any) {
    this.logger = logger
    this.path = path
    this.args = args
    this.stderrOutput = ''
    if (inputStream) this.inputStream = inputStream
    this.returnCode = new Promise(resolve => {
      this.resolveReturnCode = resolve
    })
  }

  public start(): Readable {
    this.logger.info('Spawn process', { path: this.path, args: this.args })
    this.process = spawn(this.path, this.args)

    this.process.on('close', (ret: number) => {
      this.resolveReturnCode(ret)
    })

    this.process.on('error', (err: any) => console.log('Error catch', err))
    this.process.stderr.on('data', (data: any) => (this.stderrOutput += data))

    if (this.inputStream) {
      this.inputStream.pipe(this.process.stdin).on('error', (e: any) => {
        console.log('PIPE ERROR CAPTURED', e)
      })
    }

    return this.process.stdout
  }

  public async getStdErr() {
    await this.returnCode
    return this.stderrOutput
  }

  public exitCode() {
    return this.returnCode
  }

  public kill() {}
}

export { Subprocess }
