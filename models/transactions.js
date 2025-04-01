'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Transactions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Transactions.belongsTo(models.Categories, { foreignKey: 'category_id' });
      Transactions.belongsTo(models.CardBill, { foreignKey: 'bill_id' });
      Transactions.belongsTo(models.User, { foreignKey: 'user_phone' });
    }
  }
  Transactions.init({
    user_phone: DataTypes.STRING,
    amount: DataTypes.DECIMAL,
    description: DataTypes.STRING,
    category_id: DataTypes.INTEGER,
    payment_method: DataTypes.STRING,
    credit_status: DataTypes.STRING,
    bill_id: DataTypes.INTEGER,
    transaction_date: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Transactions',
  });
  return Transactions;
};