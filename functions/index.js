const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const fetch = require("node-fetch");
const consts = require("./Constants");
const API_KEY = "AIzaSyApNgtxFBp0SXSHljP_xku6peNCzjTFWM4";
const REFERENCE_RADIUS = 100;
const location = express();
var bodyParser = require("body-parser");
admin.initializeApp();

location.use(bodyParser());
location.use(bodyParser.urlencoded({ extended: true }));
location.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

location.post("/", (req, res) => {
  console.log(req.body);
  let data = { lat: req.body.coords.latitude, lng: req.body.coords.longitude };
  admin
    .database()
    .ref()
    .child("/locations/" + req.body.user + "/position/")
    .set(data);
  res.end("fin");
});

exports.location = functions.https.onRequest(location);

exports.custom_marker_reference = functions.database
  .ref("quotes/{uid}")
  .onCreate((snapshot, context) => {
    let data = snapshot.exportVal();

    if (data.userUid) {
      let docRef = admin
        .firestore()
        .collection("clients")
        .doc(data.userUid);

      docRef
        .get()
        .then(doc => {
          if (doc.exists) {
            let userData = doc.data();

            var updates = {};
            updates["/quotes/" + context.params.uid + "/userName"] =
              userData.firstName + " " + userData.lastName;
            updates["/quotes/" + context.params.uid + "/userPhone"] = userData.phone;

            admin
              .database()
              .ref()
              .update(updates);
          } else {
            // doc.data() will be undefined in this case
            console.log("No se encontró al cliente de la orden.");
          }
        })
        .catch(function(error) {
          console.log("Error recuperando el documento del cliente de orden nueva", error);
        });
    }

    if (data.destination.name == "Marcador") {
      let query =
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=" +
        API_KEY +
        "&location=" +
        data.destination.lat +
        "," +
        data.destination.lng +
        "&radius=" +
        REFERENCE_RADIUS;

      fetch(query)
        .then(response => response.json())
        .then(responseJson => {
          let foundPlace = false;

          for (let place of responseJson.results) {
            if (place.name != "Tegucigalpa") {
              console.log("Se encontró un lugar cercano:", place.name);
              foundPlace = true;
              console.log("UID", context.params.uid);

              let detailsQuery =
                "https://maps.googleapis.com/maps/api/place/details/json?key=" +
                API_KEY +
                "&placeid=" +
                place.place_id;

              fetch(detailsQuery)
                .then(detailsResponse => detailsResponse.json())
                .then(detailsResponseJson => {
                  var updates = {};
                  updates["/quotes/" + context.params.uid + "/destination/name"] =
                    "Cerca de " + place.name;
                  updates["/quotes/" + context.params.uid + "/destination/address"] =
                    detailsResponseJson.result.formatted_address;

                  admin
                    .database()
                    .ref()
                    .update(updates);
                })
                .catch(e => {
                  console.error(e);
                  return false;
                });

              break;
            }
          }

          if (!foundPlace) {
            console.log("Lugar cercano no encontrado.");
            var updates = {};
            updates["/quotes/" + context.params.uid + "/destination/name"] = "Ubicación Exacta";
            updates["/quotes/" + context.params.uid + "/destination/address"] =
              "Lat: " + data.destination.lat + " | Lon: " + data.destination.lng;
            admin
              .database()
              .ref()
              .update(updates);
          }
        })
        .catch(e => {
          console.error(e);
          return false;
        });
    }

    return true;
  });

exports.changes_on_quote = functions.database.ref("quotes/{uid}").onUpdate(snapshot => {
  let dataBefore = snapshot.before.exportVal();
  let dataAfter = snapshot.after.exportVal();

  if (
    dataAfter.status === consts.QUOTE_STATUS_PRICE_ACCEPTED &&
    dataBefore.status !== consts.QUOTE_STATUS_PRICE_ACCEPTED
  ) {
    console.log("Nueva orden confirmada, estatus", dataAfter.status);
    return admin
      .firestore()
      .collection("drivers")
      .doc(dataAfter.driver)
      .get()
      .then(snap => {
        let data = snap.data();
        let pushTokens = data["pushDevices"];

        console.log("PushTokens:", pushTokens);

        let messages = [];

        pushTokens.forEach(token => {
          messages.push({
            to: token,
            sound: "default",
            title: "Carrera confirmada",
            body: "El cliente ha aceptado el precio propuesto.",
            data: {
              id: 3,
              order: { uid: snapshot.after.key },
            },
            channelId: "carreras",
          });
        });

        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          mode: "no-cors",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify(messages),
        });
      })
      .catch(e => console.error(e));
  } else if (dataAfter.status === consts.QUOTE_STATUS_WAITING_CLIENT) {
    console.log("Notificando llegada status", dataAfter.status);

    return admin
      .firestore()
      .collection("clients")
      .doc(dataAfter.userUid)
      .get()
      .then(snap => {
        let data = snap.data();
        let pushTokens = data["pushDevices"];

        console.log("PushTokens:", pushTokens);

        let messages = [];
        admin
          .firestore()
          .collection("drivers")
          .doc(dataAfter.driver)
          .get()
          .then(snap => {
            let driverdata = snap.data();

            pushTokens.forEach(token => {
              messages.push({
                to: token,
                sound: "default",
                title: "Tu taxi está aquí",
                body:
                  driverdata.firstName +
                  " te espera en un " +
                  driverdata.description +
                  " con placa " +
                  driverdata.plate,
                data: {
                  id: 2,
                  order: { uid: snapshot.after.key },
                },
              });
            });

            fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              mode: "no-cors",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
              body: JSON.stringify(messages),
            });
          });
      });
  } else if (dataAfter.status === consts.QUOTE_STATUS_FINISHED) {
    console.log("Notificacion rating, estatus", dataAfter.status);
    return admin
      .firestore()
      .collection("clients")
      .doc(dataAfter.userUid)
      .get()
      .then(snap => {
        let data = snap.data();
        let pushTokens = data["pushDevices"];

        let messages = [];
        admin
          .firestore()
          .collection("drivers")
          .doc(dataAfter.driver)
          .get()
          .then(snap => {
            let driverdata = snap.data();
            pushTokens.forEach(token => {
              messages.push({
                to: token,
                sound: "default",
                title: "¿Que tal estuvo tu viaje?",
                body:
                  "Hola " +
                  data.firstName +
                  ", ¿Podrias ayudarnos calificando a " +
                  driverdata.firstName +
                  ", tu ultimo conductor?",
                data: {
                  id: 3,
                  orderdata: {
                    driverName: driverdata.firstName,
                    orderUid: snapshot.after.key,
                  },
                },
              });
            });

            fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              mode: "no-cors",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
              body: JSON.stringify(messages),
            });
          });
      });
  } else if (dataAfter.status === consts.QUOTE_STATUS_CLIENT_CANCELED) {
    return admin
      .firestore()
      .collection("drivers")
      .doc(dataAfter.driver)
      .get()
      .then(snap => {
        let data = snap.data();
        let pushTokens = data["pushDevices"];

        let messages = [];
        let driverdata = snap.data();
        pushTokens.forEach(token => {
          messages.push({
            to: token,
            sound: "default",
            title: "Informacion del cliente",
            body: "Lo sentimos, el cliente ha cancelado la carrera",
            data: {
              id: 4,
            },
          });
        });

        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          mode: "no-cors",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify(messages),
        });
      });
  }
});

exports.find_reference = functions.database.ref("quotes/{uid}").onCreate((snapshot, context) => {
  let data = snapshot.exportVal();

  if (data.usingGps && !data.manual) {
    let query =
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=" +
      API_KEY +
      "&location=" +
      data.origin.lat +
      "," +
      data.origin.lng +
      "&radius=" +
      REFERENCE_RADIUS;

    fetch(query)
      .then(response => response.json())
      .then(responseJson => {
        let foundPlace = false;

        for (let place of responseJson.results) {
          if (place.name != "Tegucigalpa") {
            console.log("Se encontró un lugar cercano:", place.name);
            foundPlace = true;
            console.log("UID", context.params.uid);

            let detailsQuery =
              "https://maps.googleapis.com/maps/api/place/details/json?key=" +
              API_KEY +
              "&placeid=" +
              place.place_id;

            fetch(detailsQuery)
              .then(detailsResponse => detailsResponse.json())
              .then(detailsResponseJson => {
                var updates = {};
                updates["/quotes/" + context.params.uid + "/origin/name"] =
                  "Cerca de " + place.name;
                updates["/quotes/" + context.params.uid + "/origin/address"] =
                  detailsResponseJson.result.formatted_address;

                admin
                  .database()
                  .ref()
                  .update(updates);
              })
              .catch(e => {
                console.error(e);
                return false;
              });

            break;
          }
        }

        if (!foundPlace) {
          console.log("Lugar cercano no encontrado.");
          var updates = {};
          updates["/quotes/" + context.params.uid + "/origin/name"] = "Ubicación Exacta";
          updates["/quotes/" + context.params.uid + "/origin/address"] =
            "Lat: " + data.origin.lat + " | Lon: " + data.origin.lng;
          admin
            .database()
            .ref()
            .update(updates);
        }
      })
      .catch(e => {
        console.error(e);
        return false;
      });
  }
});

exports.operator_notification = functions.database.ref("quotes/{uid}").onCreate(snapshot => {
  let data = snapshot.exportVal();

  admin
    .database()
    .ref()
    .child("Notification_Data/")
    .once("value", snap => {
      var message = {
        data: {
          title: "Nueva orden recibida",
          body: "De " + data.origin.name + " a " + data.destination.name,
        },
        token: snap.exportVal().token,
      };
      return admin
        .messaging()
        .send(message)
        .then(response => {
          // Response is a message ID string.
          console.log("Successfully sent message:", response);
          return false;
        })
        .catch(error => {
          console.log("Error sending message:", error);
          return false;
        });
    });

  return true;
});

exports.download_url_generator = functions.storage.object().onFinalize(object => {
  const contentType = object.contentType;
  if (!contentType.startsWith("image/")) {
    return console.log("This is not an image.");
  }
  const bucket = admin.storage().bucket();
  const file = bucket.file(object.name);
  let data = object.name.split("/");
  const filename = data.pop();
  const user = data.pop();
  const options = {
    action: "read",
    expires: "12-31-2420",
  };
  // Get a signed URL for the file
  return file.getSignedUrl(options).then(results => {
    const url = results[0];
    let update;
    if (filename === "lateralcar") {
      update = { lateralcar: url };
    } else if (filename === "profile") {
      update = { profile: url };
    } else {
      update = { profilecar: url };
    }
    admin
      .firestore()
      .collection("drivers")
      .doc(user)
      .update(update);
    return true;
  });
});
exports.update_download_url = functions.pubsub.schedule("every 192 hours").onRun(context => {
  return admin
    .firestore()
    .collection("drivers")
    .get()
    .then(function(querySnapshot) {
      querySnapshot.forEach(async function(doc) {
        const bucket = admin.storage().bucket();
        let lateralcar = bucket.file("images/" + doc.id + "/" + "lateralcar");
        let profile = bucket.file("images/" + doc.id + "/" + "profile");
        let profilecar = bucket.file("images/" + doc.id + "/" + "profilecar");
        const options = {
          action: "read",
          expires: "12-31-2420",
        };
        await profile
          .getSignedUrl(options)
          .then(results => {
            const url = results[0];
            let update;
            update = { profile: url };
            admin
              .firestore()
              .collection("drivers")
              .doc(doc.id)
              .update(update);
            lateralcar
              .getSignedUrl(options)
              .then(results => {
                const url = results[0];
                let update;
                update = { lateralcar: url };
                admin
                  .firestore()
                  .collection("drivers")
                  .doc(doc.id)
                  .update(update);
                profilecar
                  .getSignedUrl(options)
                  .then(results => {
                    const url = results[0];
                    let update;
                    update = { profilecar: url };
                    admin
                      .firestore()
                      .collection("drivers")
                      .doc(doc.id)
                      .update(update);
                  })
                  .catch(error => {
                    console.log("profilecar", error);
                  });
              })
              .catch(error => {
                console.log("lateralcar", error);
              });
          })
          .catch(error => {
            console.log("profile", error);
          });
      });
    });
});

exports.delete_user_data = functions.auth.user().onDelete(user => {
  const bucket = admin.storage().bucket();
  let folder = bucket.file("images/" + user.uid);
  let isDriver = folder.exists();
  if (isDriver) {
    return admin
      .firestore()
      .collection("drivers")
      .doc(user.uid)
      .delete()
      .then(() => {
        admin
          .database()
          .ref()
          .child("locations/" + user.uid)
          .remove()
          .then(() => {
            folder.delete();
          });
      })
      .catch(() => {
        return false;
      });
  } else {
    return admin
      .firestore()
      .collection("clients")
      .doc(user.uid)
      .delete()
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  }
});

const update_http = express();
update_http.use(bodyParser());
update_http.use(bodyParser.urlencoded({ extended: true }));
update_http.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

update_http.post("/", (req, res) => {
  admin
    .firestore()
    .collection("drivers")
    .get()
    .then(function(querySnapshot) {
      querySnapshot.forEach(async function(doc) {
        console.log("estoy editando a ", doc.id, "con el tipo: ", req.body.type);
        const bucket = admin.storage().bucket();
        let lateralcar = bucket.file("images/" + doc.id + "/" + "lateralcar");
        let profile = bucket.file("images/" + doc.id + "/" + "profile");
        let profilecar = bucket.file("images/" + doc.id + "/" + "profilecar");
        const options = {
          action: "read",
          expires: "12-31-2420",
        };
        if (req.body.type === 0) {
          await profile
            .getSignedUrl(options)
            .then(results => {
              const url = results[0];
              let update;
              update = { profile: url };
              admin
                .firestore()
                .collection("drivers")
                .doc(doc.id)
                .update(update)
                .then(value => {
                  console.log("ya tiene foto de perfil ", doc.id);
                })
                .catch(error => {
                  console.log("error en perfil", doc.id, error);
                });
            })
            .catch(error => {
              console.log("error al crear url en profile", error);
            });
        } else if (req.body.type === 1) {
          lateralcar
            .getSignedUrl(options)
            .then(results => {
              const url = results[0];
              let update;
              update = { lateralcar: url };
              admin
                .firestore()
                .collection("drivers")
                .doc(doc.id)
                .update(update)
                .then(value => {
                  console.log("ya tiene foto lateral ", doc.id);
                })
                .catch(error => {
                  console.log("error en lateral", doc.id, error);
                });
            })
            .catch(error => {
              console.log("error al crear url en lateral", error);
            });
        } else if (req.body.type === 2) {
          profilecar
            .getSignedUrl(options)
            .then(results => {
              const url = results[0];
              let update;
              update = { profilecar: url };
              admin
                .firestore()
                .collection("drivers")
                .doc(doc.id)
                .update(update)
                .then(value => {
                  console.log("ya tiene foto de perfil de carro ", doc.id);
                })
                .catch(error => {
                  console.log("error en perfil de carro", doc.id, error);
                });
            })
            .catch(error => {
              console.log("error al crear url en profilecar", error);
            });
        }
      });
      res.send("Listo estan subiendose");
    });
});

exports.update_http = functions.https.onRequest(update_http);
