var express = require('express');
var router = express.Router();
var mongo = require('mongodb');

var dburl = 'mongo://localhost/favex' //url to access mongo database

router.use(function timeLog(req, res, next) {
    var date = new Date(Date.now());
    console.log('Request Recieved: ' + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + ' ' + (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear());
    next();
}); //logs every request recieved in console, should add request content type checking

router.route('/addUser').post(function (req, res) {
    
    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.end(err);
            console.log(err);
            return;
        }
        console.log(req.body)
        var users = db.collection('users');

    })
});

module.exports = router;