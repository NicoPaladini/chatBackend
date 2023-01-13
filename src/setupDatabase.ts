// We're using Mongoose as the Object Relational Model (ORM) tool, to not write directly on MongoDB DB.
// Main benefit of using Mongoose is that it provides schemas to write on the DB

import mongoose from 'mongoose';
import { config } from './config';
import Logger from 'bunyan';

const log: Logger = config.createLogger('setupDatabase');

export default () => {
  const connect = () => {
    mongoose
      .connect(`${config.DATABASE_URL}`) // DB name
      .then(() => {
        log.info('Succesfully connected to database.');
      })
      .catch((error) => {
        log.error('Error connecting to database', error);
        return process.exit(1); // Will exit the current process if there's an error
      });
  };
  connect();

  mongoose.connection.on('disconnected', connect); // Automatical reconnection function provided by mongoose
};
