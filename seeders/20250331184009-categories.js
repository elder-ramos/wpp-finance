"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
    await queryInterface.bulkInsert(
      'Categories',
      [
        {
          category: "Moradia",
          subcategory: ["Aluguel", "Condomínio", "IPTU", "Reparos"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Alimentação",
          subcategory: ["Supermercado", "Restaurantes", "Lanches"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Transporte",
          subcategory: ["Combustível", "Uber/Táxi/99", "Manutenção do carro"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Lazer",
          subcategory: ["Cinema", "Viagens", "Hobbies", "Esportes"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Assinaturas",
          subcategory: ["Streaming", "Serviços"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Saúde",
          subcategory: ["Médico", "Farmácia", "Academia"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Educação",
          subcategory: ["Cursos", "Livros", "Material escolar"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Dívidas/Empréstimos",
          subcategory: ["Cartão de crédito", "Empréstimo bancário"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Gastos Fixos",
          subcategory: ["Contas de luz/água", "Internet", "Seguros"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Imprevistos",
          subcategory: ["Consertos emergenciais", "Multas"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Doações/Presentes",
          subcategory: ["Presentes", "Caridade"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Vestuário/Cuidados",
          subcategory: ["Roupas", "Cosméticos", "Cabeleireiro"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Investimentos/Poupança",
          subcategory: ["Aplicações", "Reserva de emergência"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category: "Outros",
          subcategory: ["Outros"],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('Categories', null, {});
  },
};
