var express = require('express');
var router = express.Router();
var mongo = require('mongodb');
var dburl = 'mongodb://localhost/favex' //url to access mongo database
var googleMapsKey= require('./apiKeys.js').googleMapsKey;
var googleMapsClient = require('@google/maps').createClient(
  {
    key: googleMapsKey
  });


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

router.route('/addFavor').post(function(req,res)
{
  mongo.connect(dburl, function (err, db)
  {
      if (err)
      {
          res.send(false);
          console.log(err);
          return;
      }

    var favors= db.collection('favors');

    favors.insertOne(req.body.favor, function (err, object)
    {
      if (err)
      {
          res.send(false);
          console.log(err);
      }
      else
      {
        res.send(true);
        console.log('favor added to favors collection');
      }
      db.close();
    });

    var users= db.collection('users');

    users.findOneAndUpdate({"_id": new mongo.ObjectID(req.body.favor.recipientId)},
    {$push: {favors: req.body.favor._id}},
    function(err, result)
    {
      if (err)
      {
          res.send(false);
          console.log(err);
      }
      else
      {
        res.send(true);
        console.log('favor id added to recipient user document');
      }
      db.close();
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
                db.close();
                return;
            }

            res.send(docs[0]);
            db.close();

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
                        db.close();
                        return;
                    }
                    if (docs[0] === undefined) {
                        res.send(true);
                        console.log('invalid json object')
                        db.close();
                        return;
                    }
                    if (docs[0].recipientId === foundUser.facebookId) {
                        favorArray.push(docs[0]);
                    }

                    favorsIter++;
                    if (favorsIter === favorIdArray.length) {
                        res.send(favorArray);
                        console.log('favor array sent')
                        db.close();
                    }

                });
            }

        });

    });
});

router.route('/getFavorsDone').get(function (req, res)
{
  if(req.query.id=== undefined)
  {
    res.send(false);
    console.log('Missing id parameter');
    return;
  }
  else if (req.query.id.length=== 0)
  {
    res.send(false);
    console.log('id key is empty');
    return;
  }
  else
  {
    mongo.connect(dburl, function (err, db)
    {
      if (err)
      {
          res.send(false);
          console.log(err);
          return;
      }

      var favors= db.collection('favors');

      favors.find({"doerId": req.query.id}).toArray(function (err, docs)
      {
        if(err)
        {
          res.send(false);
          console.log(err);
          db.close();
          return;
        }
        else
        {
          res.send(docs);
          console.log('favorsDone sent');
          db.close();
        }
      });
    });
  }
});

router.route('/getNearbyFavors').get(function (req, res)
{
  var lat= req.query.lat;
  var lng= req.query.lng;
  var radius = (req.query.radius!= undefined && req.query.radius.length!= 0)?
  req.query.radius : 500; //uses default value meters when radius n/a
  if(req.query.lat=== undefined || req.query.lng=== undefined)
  {
    res.send(false);
    console.log('Missing lat or lng parameter');
    return;
  }
  else if (req.query.lat.length=== 0 || req.query.lng.length=== 0)
  {
    res.send(false);
    console.log('lat or lng key is empty');
    return;
  }
  else
  {
    var userLocation=
    {
      lat: lat,
      lng: lng
    };
    mongo.connect(dburl, function (err, db)
    {
      if (err)
      {
          res.send(false);
          console.log(err);
          db.close();
          return;
      }
      var favors= db.collection('favors');
      favors.find({"doerId": null}).toArray(function (err,openFavors)
      //above returns favors withour doerId fiels or favors with doerId set to null
      {
        if (err)
        {
            res.send(false);
            console.log(err);
            db.close();
            return;
        }
        else
        {
          var favorLocations= [];
          for(var i=0; i< openFavors.length; i++)
            favorLocations.push(openFavors[i].locationFavor);
          if(favorLocations.length === 0)
          {
            res.send(false);
            console.log('no nearby favors available');
            db.close();
            return;
          }
          else
          {
            var distanceQuery =
            {
              origins: userLocation,
              destinations: favorLocations,
              mode: 'walking'
            }
            googleMapsClient.distanceMatrix(distanceQuery, function (err, result)
            {
              if (err)
              {
                  res.send(false);
                  console.log(err);
                  db.close();
                  return;
              }
              else
              {
                  var nearbyFavors = [];
                  for(var i=0; i< result.json.rows[0].elements.length; i++)
                  {
                    if(result.json.rows[0].elements[i].distance.value<=radius)
                    {
                      nearbyFavors.push(openFavors[i]);
                      console.log("");
                    }
                  }
                  res.send(nearbyFavors);
                  console.log('nearby favors sent');
                  db.close();
              }
            });
          }
        }
      });
    });
  }
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
                    db.close();
                    return;
                }

                res.send(true);
                console.log("location of user: " + req.body.user.facebookId + " updated successfully");
                db.close();
            }
        );
    });
});

router.route('/updateTip').put(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        console.log('invalid favor object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            console.log(err);
            return;
        }

        var favors = db.collection('favors');

        favors.updateOne(
            {"_id" : new mongo.ObjectID(req.body.favor._id)},
            {$set : {"tip" : req.body.favor.tip}},
            { w: 1 },
            function(err, object){
                if(err){
                    res.send(false);
                    console.log(err);
                    return;
                }

                res.send(true);
                console.log("tip of favor: " + req.body.favor._id + " updated successfully");
                db.close();
            }
        );
    });
});

router.route('/updateFavorStatus').put(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        console.log('invalid favor object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            console.log(err);
            return;
        }

        var favors = db.collection('favors');

        favors.updateOne(
            {"_id" : new mongo.ObjectID(req.body.favor._id)},
            {$set : {"isComplete" : req.body.favor.isComplete}},
            { w: 1 },
            function(err, object){
                if(err){
                    res.send(false);
                    console.log(err);
                    return;
                }

                res.send(true);
                console.log("status of favor: " + req.body.favor._id + " updated successfully");
                db.close();
            }
        );
    });
});

router.route('/updateDoer').put(function (req,res)
{
  if (req.body.favor === undefined)
  {
      res.send(false)
      console.log('invalid user favor sent');
      return;
  }
  else
  {
    mongo.connect(dburl, function (err, db)
    {
        if (err)
        {
            res.send(false);
            console.log(err);
            return;
        }
        var favors = db.collection('favors');
        favors.findOneAndUpdate({"_id" : new mongo.ObjectID(req.body.favor._id)},
        {$set : {"doerId" : req.body.favor.doerId}}, null,
        function (err, result)
        {
          if(err)
          {
            res.send(false);
            console.log(err);
            db.close();
            return;
          }
          else
          {
            res.send(true);
            console.log("doerId: " + req.body.favor.doerId + " updated successfully");
            db.close();
          }
        });
    });
  }
});


router.route('/deleteFavor').delete(function(req, res){
    if (req.body.favor === undefined) {
        res.send(false)
        console.log('invalid favor object sent');
        return;
    }

    mongo.connect(dburl, function(err, db){
        if(err){
            res.send(false);
            console.log(err);
            return;
        }

        var favors = db.collection('favors');

        favors.remove(
            {"_id" : new mongo.ObjectID(req.body.favor._id)},
            function(err){
                if(err){
                    res.send(false);
                    console.log(err);
                    db.close();
                    return;
                }

                res.send(true);
                console.log('favor: ' + req.body.favor._id + ' successfully deleted');
                db.close();
            }
        );
    });
});

module.exports = router;
