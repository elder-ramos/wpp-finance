const { Sequelize } = require("sequelize");
const { z } = require("zod");

const sequelize = new Sequelize(
  "postgres://user:password@postgres:5432/postgres"
);

const Users = sequelize.define(
  "Users",
  {
    phone: {
      type: Sequelize.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    user_name: {
      type: Sequelize.STRING(50),
      allowNull: false,
    },
  },
  {
    timestamps: true,
  }
);

const Transactions = sequelize.define(
  "Transactions",
  {
    user_phone: {
      type: Sequelize.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    amount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    description: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    category_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    payment_method: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    credit_status: {
      type: Sequelize.STRING(15),
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

const CardBills = sequelize.define("CardBills", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  user_phone: {
    type: Sequelize.STRING(30),
    allowNull: false,
  },
  paid_amount: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false,
  },
  payment_date: {
    type: Sequelize.DATE,
    allowNull: false,
  },
  bill_description: {
    type: Sequelize.STRING(255),
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
});

class dbService {
  constructor() {
    this.sequelize = sequelize;
    this.Users = Users;
    this.Transactions = Transactions;
    this.CardBills = CardBills;
  }

  async connect() {
    try {
      await this.sequelize.authenticate();
      console.log("Connection has been established successfully.");
    } catch (error) {
      console.error("Unable to connect to the database:", error);
    }
  }

  async createUser(userData) {
    try {
      const user = await this.Users.create(userData);
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async userFindOrCreate(userData) {
    return await this.Users.findOrCreate({
      where: { phone: userData.phone },
      defaults: { user_name: userData.name },
    });
  }

  async transactionCreate(transactionData) {
    try {
      const transaction = await this.Transactions.create(transactionData);
      return transaction;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  async close() {
    await this.sequelize.close();
  }
}

export default dbService;