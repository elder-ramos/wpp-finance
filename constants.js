class Constants {
  static get CATEGORIES() {
    return [
      {
        category: "Moradia",
        subcategory: ["Aluguel", "Condomínio", "IPTU", "Reparos"],
      },
      {
        category: "Alimentação",
        subcategory: ["Supermercado", "Restaurantes", "Lanches"],
      },
      {
        category: "Transporte",
        subcategory: ["Combustível", "Uber/Táxi/99", "Manutenção do carro"],
      },
      {
        category: "Lazer",
        subcategory: ["Cinema", "Viagens", "Hobbies", "Esportes"],
      },
      {
        category: "Assinaturas",
        subcategory: ["Streaming", "Serviços"],
      },
      {
        category: "Saúde",
        subcategory: ["Médico", "Farmácia", "Academia"],
      },
      {
        category: "Educação",
        subcategory: ["Cursos", "Livros", "Material escolar"],
      },
      {
        category: "Dívidas/Empréstimos",
        subcategory: ["Cartão de crédito", "Empréstimo bancário"],
      },
      {
        category: "Gastos Fixos",
        subcategory: ["Contas de luz/água", "Internet", "Seguros"],
      },
      {
        category: "Imprevistos",
        subcategory: ["Consertos emergenciais", "Multas"],
      },
      {
        category: "Doações/Presentes",
        subcategory: ["Presentes", "Caridade"],
      },
      {
        category: "Vestuário/Cuidados",
        subcategory: ["Roupas", "Cosméticos", "Cabeleireiro"],
      },
      {
        category: "Investimentos/Poupança",
        subcategory: ["Aplicações", "Reserva de emergência"],
      },
      {
        category: "Outros",
        subcategory: ["Outros"],
      },
    ];
  }

  static get TIMEOUT() {
    return 5000; // 5 seconds
  }

  static get MAX_RETRIES() {
    return 3;
  }
}

export { Constants };