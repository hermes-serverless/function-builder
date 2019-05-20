FROM docker:18.09

RUN apk add --no-cache yarn nodejs

WORKDIR /app/server

COPY ./FunctionBuilder/package.json ./FunctionBuilder/yarn.lock ./

RUN yarn

COPY ./FunctionBuilder .

COPY ./ProjectBuilderImages /app/ProjectBuilderImages

COPY ./FunctionWatcher /app/FunctionWatcher

CMD [ "yarn", "nodemon" ]