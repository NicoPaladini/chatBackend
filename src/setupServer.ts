import { CustomError, IErrorResponse } from './shared/globals/helpers/error-handler';
import { Application, json, urlencoded, Response, Request, NextFunction } from 'express';
import http from 'http';
import compression from 'compression'; // to compress out requests and responses
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import cookieSession from 'cookie-session';
import HTTP_STATUS from 'http-status-codes';
import 'express-async-errors';
import { config } from './config';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import aplicationRoutes from './routes';
import Logger from 'bunyan';

// Installed libraries:
// CORS, Helmet & Hpp: security middleware
// Cookie-session & compression: standard middlewares --> To save data on cookies (for userId, userImage ...)
// express-async-errors: to be able to catch errors from async await methods

const SERVER_PORT = 6000;
const log: Logger = config.createLogger('setupServer');

export class ChattyServer {
  // Express instance
  private app: Application;
  constructor(app: Application) {
    this.app = app;
  }

  public start(): void {
    this.securityMiddleware(this.app);
    this.standardMiddleware(this.app);
    this.routeMiddleware(this.app);
    this.globalErrorHandler(this.app);
    this.startServer(this.app);
  }

  private securityMiddleware(app: Application): void {
    // app.use method is an express method to call middlewares
    app.use(
      cookieSession({
        // Name is used to setup load balance on AWS
        name: 'session',
        keys: [config.SECRET_KEY_ONE!, config.SECRET_KEY_TWO!],
        // MaxAge: amount of time the cookie will be valid (in miliseconds), when user logs in and out, the cookie us renewed.
        maxAge: 24 * 7 * 3600000, // Valid for 7 days
        secure: config.NODE_ENV !== 'development'
      })
    );
    app.use(hpp());
    app.use(helmet());
    app.use(
      cors({
        origin: config.CLIENT_URL,
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] // Available http methods
      })
    );
  }

  private standardMiddleware(app: Application): void {
    app.use(compression());
    app.use(json({ limit: '50mb' })); // Each request must not exceed 50Mb otherwise will drop an error
    app.use(urlencoded({ extended: true, limit: '50mb' }));
  }

  private routeMiddleware(app: Application): void {
    aplicationRoutes(app);
  }

  // To handle application errors
  private globalErrorHandler(app: Application): void {
    // This middleware is made to catch errors from URLs that are not available
    app.all('*', (req: Request, res: Response) => {
      res.status(HTTP_STATUS.NOT_FOUND).json({ message: `${req.originalUrl} not found` });
    });

    app.use((error: IErrorResponse, _req: Request, res: Response, next: NextFunction) => {
      log.error(error);
      if (error instanceof CustomError) {
        res.status(error.statusCode).json(error.serializeErrors());
      }
      next();
    });
  }

  private async startServer(app: Application): Promise<void> {
    try {
      const httpServer: http.Server = new http.Server(app);
      const socketIO: Server = await this.createSocketIO(httpServer);
      this.socketIOConnections(socketIO);
      this.startHttpServer(httpServer);
    } catch (error) {
      log.error(error);
    }
  }

  private async createSocketIO(httpServer: http.Server): Promise<Server> {
    const io: Server = new Server(httpServer, {
      cors: {
        origin: config.CLIENT_URL,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      }
    });
    const pubClient = createClient({ url: config.REDIS_HOST });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    return io;
  }

  // Will be called inside of createSocketIO function
  private startHttpServer(httpServer: http.Server): void {
    log.info(`Server has started with process ${process.pid}`);

    httpServer.listen(SERVER_PORT, () => {
      log.info(`Server running on port: ${SERVER_PORT}`);
    });
  }

  private socketIOConnections(io: Server): void {}
}
