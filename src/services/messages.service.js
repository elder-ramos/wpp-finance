import axios from "axios";

class MessagesService {
  switchMessageType(message) {
    switch (this.messageFirstWord(message)) {
      case "/add":
        return "Added!";
      case "/remove":
        return "Removed!";
      default:
        return "Unknown command!";
    }
  }

  messageFirstWord(message) {
    const splitMessage = message.split(" ");
    console.log("splitMessage: ", splitMessage[0]);
    if (splitMessage.length > 0) {
      return splitMessage[0];
    }
    return "";
  }

  async requestIA(message) {
    try {
      axios
        .post("http://ollama:11434/api/generate", {
          model: "wpp-finance-bot",
          prompt: message,
          format: "json",
          stream: false,
        })
        .then((response) => {
          if (response.done_reason != "stop") {
            console.error("Error: ", response);
          } else {
            console.log("Response: ", response);
            return response.response;
          }
        });
    } catch (error) {
      console.error("Error: ", error);
      return String(error);
    }
  }
}

export default MessagesService;
