var express = require('express');
var router = express.Router();
var mongo = require('mongodb');

var dburl = 'mongodb://localhost/favex' //url to access mongo database

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

        var users = db.collection('users');

        users.updateOne(
            { 'facebookId': req.body.user.facebookId },   //find user by fb id
            req.body.user,                      //replace user found in db with this user object
            { upsert: true, w: 1 },                //add new object if doesn't exist
            function (err, object) {
                if (err) {
                    res.end(err);
                    console.log(err);
                    db.close();
                    return;
                }
                else {
                    res.end('added successfully');
                    console.log('user added successfully');    //temp output to log inserted user
                    db.close();
                }
            });
    });
});

router.route('getFavorRequested').get(function(req, res){

    mongo.connect(dburl, function(err, db){
        if(err){
            res.end(err);
            console.log(err);
            return;
        }
    });
});

module.exports = router;