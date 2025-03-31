import { Sequelize } from "sequelize";

const sequelize = new Sequelize(
  "postgres://user:password@0.0.0.0:5432/postgres"
);

try {
  await sequelize.authenticate();
  console.log("Connection has been established successfully.");
} catch (error) {
  console.error("Unable to connect to the database:", error);
}
