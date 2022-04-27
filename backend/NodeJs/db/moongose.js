const mongoose = require('mongoose');

mongoURI = 'mongodb+srv://Soen:17^Th082000@nodejs.7dcz4.mongodb.net/nodejs?retryWrites=true&w=majority'

mongoose.connect(mongoURI, { useNewUrlParser: true})
    .then(() => {
        console.log('connected to database');
    })
    .catch((e) => {
        console.log('error is ', e);
    })

module.exports = {
    mongoose
}