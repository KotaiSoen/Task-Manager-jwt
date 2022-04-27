const mongoose = require('mongoose');

mongoURI = 'mongodb+srv://password@nodejs.7dcz4.mongodb.net/project-name?retryWrites=true&w=majority'

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
