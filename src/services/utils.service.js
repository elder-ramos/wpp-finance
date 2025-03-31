class utilsService {
    extractUserData(message) {
        const phone = message.from.replace(/\D/g, '').replace('@c.us', '');
        const userData = {
            phone: phone,
            name: message.notifyName ?? phone 
        };
        return userData;
    };
}

export default utilsService;