'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CardBill extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      CardBill.belongsTo(models.User, { foreignKey: 'user_phone' });
    }
  }
  CardBill.init({
    user_phone: DataTypes.STRING(30),
    paid_amount: DataTypes.DECIMAL(10, 2),
    payment_date: DataTypes.DATE,
    bill_description: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'CardBill',
  });
  return CardBill;
};