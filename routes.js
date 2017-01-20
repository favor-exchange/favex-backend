'use strict';
var express = require('express');
var router = express.Router();
var mongo = require('mongodb');
var dburl= require('./apiKeys.js').mongoLabUrl;
var winston = require('winston');

var fs = require('fs');
const env = 'development';
const logDir = 'log'

var googleMapsKey = require('./apiKeys.js').googleMapsKey;
var googleMapsClient = require('@google/maps').createClient(
    {
        key: googleMapsKey
    });

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}


const tsFormat = () => (new Date()).toLocaleTimeString();
const logger = new (winston.Logger)({
  transports: [
    // colorize the output to the console
    new (winston.transports.Console)({
      timestamp: tsFormat,
      colorize: true,
      level: 'info'
    }),
    new (require('winston-daily-rotate-file'))({
      filename: `${logDir}/-results.log`,
      timestamp: tsFormat,
      datePattern: 'yyyy-MM-dd',
      prepend: true,
      level: env === 'development' ? 'verbose' : 'info'
    })
  ]
});
logger.debug('Debugging info');
logger.verbose('Verbose info');
logger.info('Hello world');
logger.warn('Warning message');
logger.error('Error info');


router.use(function timeLog(req, res, next) {
    var date = new Date(Date.now());
    logger.info('Request Recieved: ' + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + ' ' + (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear());
    next();
}); //logs every request recieved in console, should add request content type checking

router.route('/addUser').post(function (req, res) {

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
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
                    logger.info(err);
                    db.close();
                    return;
                }
                else {
                    res.send(true);
                    logger.info('user added successfully');    //temp output to log inserted user
                    db.close();
                }
            });
    });
});

router.route('/addFavor').post(function (req, res) {
    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.insertOne(req.body.favor, function (err, object) {
            if (err) {
                res.send(false);
                logger.info(err);
            }
            else {
                res.send(true);
                logger.info('favor added to favors collection');
            }
            db.close();
        });
    });
});

router.route('/getUser').get(function (req, res) {
    //check if user object sent
    if (req.query.id === undefined) {
        res.send(false)
        logger.info('Missing id parameter');
        return;
    }

    if (req.query.id.length === 0) {
        res.send(false);
        logger.info('id key is empty');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var users = db.collection('users');

        users.find({ 'facebookId': req.query.id }).toArray(function (err, docs) {
            if (err) {
                res.send(false);
                logger.info(err);
                db.close();
                return;
            }

            res.send(docs[0]);
            db.close();

        });
    });

});

router.route('/getFavorsRequested').get(function (req, res) {
    if (req.query.id === undefined) {
        res.send(false)
        logger.info('missing id parameter');
        return;
    }

    if (req.query.id.length === 0) {
        res.send(false);
        logger.info('id key is empty');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.find({ "recipientId": req.query.id }).toArray(function (err, docs) {
            if (err) {
                res.send(false);
                logger.info(err);
                db.close();
                return;
            }
            else {
                res.send(docs);
                logger.info('favorsRequested sent');
                db.close();
            }
        });

    });
});

router.route('/getFavorsDone').get(function (req, res) {
    if (req.query.id === undefined) {
        res.send(false);
        logger.info('missing id parameter');
        return;
    }
    else if (req.query.id.length === 0) {
        res.send(false);
        logger.info('id key is empty');
        return;
    }
    else {
        mongo.connect(dburl, function (err, db) {
            if (err) {
                res.send(false);
                logger.info(err);
                return;
            }

            var favors = db.collection('favors');

            favors.find({ "doerId": req.query.id }).toArray(function (err, docs) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }
                else {
                    res.send(docs);
                    logger.info('favorsDone sent');
                    db.close();
                }
            });
        });
    }
});

router.route('/getNearbyFavors').get(function (req, res) {
    var userLocationId = req.query.userLocationId;
    var distance = (req.query.distance != undefined && req.query.distance.length != 0) ?
        req.query.distance : 500; //uses default value meters when radius n/a
    if (req.query.userLocationId === undefined)
    {
        res.send(false);
        logger.info('Missing userLocationId parameter');
        return;
    }
    else if (req.query.userLocationId.length === 0)
    {
        res.send(false);
        logger.info('userLocationId key is empty');
        return;
    }
    else
    {
        mongo.connect(dburl, function (err, db) {
        if (err)
        {
            res.send(false);
            logger.info(err);
            db.close();
            return;
         }
        var favors = db.collection('favors');
        favors.find({ "doerId": null }).toArray(function (err, openFavors)
        //above returns favors without doerId fiels or favors with doerId set to null
        {
            if (err)
            {
                res.send(false);
                logger.info(err);
                db.close();
                return;
            }
            else
            {
                if (openFavors.length === 0)
                {
                    res.send(false);
                    logger.info('no favors available');
                    db.close();
                    return;
                }
                else
                {
                    var userCoordinatesQuery=
                    {
                        placeid:userLocationId
                    };
                    googleMapsClient.place(userCoordinatesQuery, function (err, result) //to find lat and lng of user
                    {
                      if (err)
                      {
                          res.send(false);
                          logger.info(err);
                          db.close();
                          return;
                      }
                      var userLat=result.json.result.geometry.location.lat;
                      var userLng=result.json.result.geometry.location.lng;
                      var userLocationObj=
                      {
                          lat:userLat,
                          lng:userLng
                      };
                      logger.info("user coordinates "+userLat+" "+userLng);
                      var favorLocationObjArray= []; //will store {lat:x,lng:y} for each favor location
                      var recursive = function populateFavorLocationObjArray(index)
                      {
                        if(index===openFavors.length)
                        {
                          var distanceFromUserToFavorQuery =
                          {
                              origins: userLocationObj,
                              destinations: favorLocationObjArray,
                              mode: 'walking'
                          };
                          googleMapsClient.distanceMatrix(distanceFromUserToFavorQuery, function (err, result)
                          {
                              if (err)
                              {
                                  res.send(false);
                                  logger.info(err);
                                  db.close();
                                  return;
                              }
                              else
                              {
                                var distanceArray= []; //stores total distance that doer will travel
                                for (var j = 0; j < result.json.rows[0].elements.length; j++)
                                {
                                    if(!result.json.rows[0].elements[j].hasOwnProperty("distance")
                                      || result.json.rows[0].elements[j].distance.value>distance) //remove large distances
                                    {
                                        logger.info(result.json.rows[0].elements);
                                        logger.info(openFavors.splice(j,1));
                                        favorLocationObjArray.splice(j,1);
                                    }
                                    else
                                    {
                                        distanceArray.push(result.json.rows[0].elements[j].distance.value);
                                        logger.info("pushed");
                                    }
                                  }
                                  var openFavorsLength= openFavors.length; //saved as value will be altered below
                                  logger.info("openfavorslength "+openFavors.length);
                                  var recursive1= function queryEachDestination(index)
                                  {
                                    if(index===openFavorsLength)
                                    {
                                      for(var m=0;m<distanceArray.length;m++)
                                      {
                                        if(distanceArray[m]>distance)
                                          openFavors.splice(m,1);
                                      }
                                      logger.info("completed algorithm");
                                      res.send(openFavors);
                                      return;
                                    }
                                    var destinationCoordinatesQuery=
                                    {
                                        placeid:openFavors[index].locationRecipientId
                                    };
                                    googleMapsClient.place(destinationCoordinatesQuery, function (err, result) //to find lat and lng of destination
                                        {
                                            if (err)
                                            {
                                                res.send(false);
                                                logger.info(err);
                                                db.close();
                                                return;
                                            }
                                            var destinationLat=result.json.result.geometry.location.lat;
                                            var destinationLng=result.json.result.geometry.location.lng;
                                            var destinationObj=
                                            {
                                                lat:destinationLat,
                                                lng:destinationLng
                                            };
                                            logger.info(destinationObj);
                                            var distanceFromFavorToRecipientQuery =
                                            {
                                                origins: favorLocationObjArray[index],
                                                destinations: destinationObj,
                                                mode: 'walking'
                                            };
                                            logger.info(distanceFromFavorToRecipientQuery);
                                            googleMapsClient.distanceMatrix(distanceFromFavorToRecipientQuery, function (err, result)
                                            {
                                                if (err)
                                                {
                                                    res.send(false);
                                                    logger.info(err);
                                                    db.close();
                                                    return;
                                                }
                                                if (!result.json.rows[0].elements[0].hasOwnProperty("distance")
                                                    || result.json.rows[0].elements[0].distance.value>distance)
                                                {
                                                  openFavors.splice(index,1);
                                                  distanceArray.splice(index,1);
                                                }
                                                else
                                                {
                                                    distanceArray[index]=distanceArray[index]+result.json.rows[0].elements[0].distance.value;
                                                    logger.info("distArray "+distanceArray[index])
                                                }
                                                logger.info("here");
                                                queryEachDestination(++index);
                                          });
                                        });
                                  }(0);
                                }
                              });
                          return;
                        }
                        var favorCoordinatesQuery=
                        {
                            placeid:openFavors[index].locationFavorId //contains id of favor location
                        };
                        logger.info("favor id "+openFavors[index].locationFavorId);
                        googleMapsClient.place(favorCoordinatesQuery, function (err, result)
                        {
                          if (err)
                          {
                              res.send(false);
                              logger.info(err);
                              db.close();
                              return;
                          }
                          var favorLat=result.json.result.geometry.location.lat;
                          var favorLng=result.json.result.geometry.location.lng;
                          logger.info("favor coordinates "+favorLat+" "+favorLng);
                          var favorLocationObj=
                          {
                                lat:favorLat,
                                lng:favorLng
                          };
                          favorLocationObjArray.push(favorLocationObj);
                          logger.info(favorLocationObjArray);
                          populateFavorLocationObjArray(++index);
                        });
                      }(0);
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
        logger.info('invalid user object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var users = db.collection('users');

        users.updateOne(
            { "facebookId": req.body.user.facebookId },
            { $set: { "location": req.body.user.location } },
            function (err, object) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }

                res.send(true);
                logger.info("location of user: " + req.body.user.facebookId + " updated successfully");
                db.close();
            }
        );
    });
});

router.route('/updateTip').put(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        logger.info('invalid favor object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.updateOne(
            { "_id": new mongo.ObjectID(req.body.favor._id) },
            { $set: { "tip": req.body.favor.tip } },
            { w: 1 },
            function (err, object) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    return;
                }

                res.send(true);
                logger.info("tip of favor: " + req.body.favor._id + " updated successfully");
                db.close();
            }
        );
    });
});

router.route('/updateFavorStatus').put(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        logger.info('invalid favor object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.updateOne(
            { "_id": new mongo.ObjectID(req.body.favor._id) },
            { $set: { "isComplete": req.body.favor.isComplete } },
            { w: 1 },
            function (err, object) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    return;
                }

                res.send(true);
                logger.info("status of favor: " + req.body.favor._id + " updated successfully");
                db.close();
            }
        );
    });
});

router.route('/updateDoer').put(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        logger.info('invalid user favor sent');
        return;
    }
    else {
        mongo.connect(dburl, function (err, db) {
            if (err) {
                res.send(false);
                logger.info(err);
                return;
            }
            var favors = db.collection('favors');
            favors.findOneAndUpdate({ "_id": new mongo.ObjectID(req.body.favor._id) },
                { $set: { "doerId": req.body.favor.doerId } },
                function (err, result) {
                    if (err) {
                        res.send(false);
                        logger.info(err);
                        db.close();
                        return;
                    }
                    else {
                        res.send(true);
                        logger.info("doerId: " + req.body.favor.doerId + " updated successfully");
                        db.close();
                    }
                });
        });
    }
});

router.route('/updateRating').put(function (req, res) {
    if (req.body.user === undefined) {
        res.send(false)
        logger.info('invalid user object sent');
        return;
    }
    else {
        mongo.connect(dburl, function (err, db) {
            if (err) {
                res.send(false);
                logger.info(err);
                return;
            }
            var users = db.collection('users');
            users.findOneAndUpdate({ "_id": new mongo.ObjectID(req.body.user._id) },
                { $set: { "rating": req.body.user.rating } },
                function (err, result) {
                    if (err) {
                        res.send(false);
                        logger.info(err);
                        db.close();
                        return;
                    }
                    else {
                        res.send(true);
                        logger.info("rating: " + req.body.user.rating + " updated successfully");
                        db.close();
                    }
                });
        });
    }
});

router.route('/deleteFavor').delete(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        logger.info('invalid favor object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.remove(
            { "_id": new mongo.ObjectID(req.body.favor._id) },
            function (err) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }

                res.send(true);
                logger.info('favor: ' + req.body.favor._id + ' successfully deleted');
                db.close();
            }
        );
    });
});

router.route('/deleteUser').delete(function (req, res) {
    if (req.body.user === undefined) {
        res.send(false)
        logger.info('invalid user object sent');
        return;
    }
    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }
        var users = db.collection('users');
        users.remove(
            { "_id": new mongo.ObjectID(req.body.user._id) },
            function (err) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }
                res.send(true);
                logger.info('user: ' + req.body.user._id + ' successfully deleted');
                db.close();
            }
        );
    });
});

module.exports = router;
