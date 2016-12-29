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
            res.send(false);
            console.log(err);
            return;
        }

        var users = db.collection('users');

        users.updateOne(
            { "facebookId": req.body.user.facebookId },   //find user by fb id
            req.body.user,                      //replace user found in db with this user object
            { upsert: true, w: 1 },                //add new object if doesn't exist
            function (err, object) {
                if (err) {
                    res.send(false);
                    console.log(err);
                    db.close();
                    return;
                }
                else {
                    res.send(true);
                    console.log('user added successfully');    //temp output to log inserted user
                    db.close();
                }
            });
    });
});

router.route('/getUser').post(function (req, res) {
    //check if user object sent
    if (req.body.user === undefined) {
        res.send(false)
        console.log('invalid user object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            console.log(err);
            return;
        }

        var users = db.collection('users');

        users.find({ 'facebookId': req.body.user.facebookId }).toArray(function (err, docs) {
            if (err) {
                res.send(false);
                console.log(err);
                return;
            }

            res.send(docs[0]);

        });
    });

});

router.route('/getFavorsRequested').post(function (req, res) {
    if (req.body.user === undefined) {
        res.send(false)
        console.log('invalid user object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            console.log(err);
            return;
        }

        var users = db.collection('users');

        users.find({ 'facebookId': req.body.user.facebookId }).toArray(function (err, docs) {

            if (err) {
                res.send(false);
                console.log(err);
                return;
            }

            var foundUser = docs[0];

            var favorIdArray = []; //array containing mongo ids of favors stored in user object
            for (var item in foundUser.favors) {
                favorIdArray.push(foundUser.favors[item].id); //access each id property from array of favor objetcs inside foundUser
            }

            var favors = db.collection('favors');

            var favorArray = []; //array of json objects of favors found in favor db
            var favorsIter = 0; //used to call res.send() when all favors iterated through
            for (var i = 0; i < favorIdArray.length; i++) {
                favors.find({ "_id": new mongo.ObjectID(favorIdArray[i]) }).toArray(function (err, docs) {

                    if (err) {
                        res.send(false);
                        console.log(err);
                        return;
                    }
                    if (docs[0] === undefined) {
                        res.send(true);
                        console.log('invalid json object')
                        return;
                    }
                    if (docs[0].recipientId === foundUser.facebookId) {
                        favorArray.push(docs[0]);
                    }

                    favorsIter++;
                    if (favorsIter === favorIdArray.length) {
                        res.send(favorArray);
                        console.log('favor array sent')
                    }

                });
            }

        });

    });
});

router.route('/updateLocation').put(function (req, res) {
    if (req.body.user === undefined) {
        res.send(false)
        console.log('invalid user object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            console.log(err);
            return;
        }

        var users = db.collection('users');

        users.updateOne(
            {"facebookId" : req.body.user.facebookId},
            {$set : {"location" : req.body.user.location}},
            function(err, object){
                if(err){
                    res.send(false);
                    console.log(err);
                    return;
                }

                res.send(true);
                console.log("location of user: " + req.body.user.facebookId + " updated successfully");
            }
        );
    });
});

module.exports = router;