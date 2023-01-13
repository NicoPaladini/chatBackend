import { config } from './config';
import express, { Express } from 'express';
import { ChattyServer } from './setupServer';
import databaseConnection from './setupDatabase';

class Application {
  public initialize(): void {
    this.loadConfig();
    databaseConnection();
    const app: Express = express(); // Creates instance of express
    const server: ChattyServer = new ChattyServer(app); // Creates instance of server
    server.start(); // Executes start method
  }

  private loadConfig(): void {
    config.validateConfig();
  }
}

const application: Application = new Application();
application.initialize();
