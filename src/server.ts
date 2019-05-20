import { getBuildRouter } from './routes/build'
import express from 'express'
import morgan from 'morgan'
import { logger } from './utils/Logging'

const server = express()

server.use(express.json())
server.use(morgan('dev'))

server.use('/build', getBuildRouter(logger))

server.use('/', (req, res) => {
  res.status(404).send('Not found')
})

const PORT = 3001
server.listen(PORT, () => {
  logger.info(`Server listening on port http://localhost:${PORT}`)
})
