"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CardBills", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_phone: {
        allowNull: false,
        type: Sequelize.STRING(30),
      },
      paid_amount: {
        allowNull: false,
        type: Sequelize.DECIMAL(10, 2),
      },
      payment_date: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      bill_description: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CardBills");
  },
};
