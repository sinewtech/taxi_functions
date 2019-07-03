const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const fetch = require("node-fetch");
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

exports.confirm_quote = functions.database.ref("quotes/{uid}").onUpdate(snapshot => {
  let dataBefore = snapshot.before.exportVal();
  let dataAfter = snapshot.after.exportVal();

  if (dataAfter.status == 2 && dataBefore.status != 2) {
    console.log("Nueva orden confirmada");
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
  } else if (dataAfter.status === 5) {
    console.log("Notificando llegada");

    return admin
      .firestore()
      .collection("clients")
      .doc(dataAfter.userUID)
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
                body: driverdata.firstName + " te espera en un auto con placa " + driverdata.plate,
                data: {
                  id: 2,
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
        await lateralcar.getSignedUrl(options).then(results => {
          const url = results[0];
          let update;
          update = { lateralcar: url };
          admin
            .firestore()
            .collection("drivers")
            .doc(doc.id)
            .update(update);
        });
        await profile.getSignedUrl(options).then(results => {
          const url = results[0];
          let update;
          update = { profile: url };
          admin
            .firestore()
            .collection("drivers")
            .doc(doc.id)
            .update(update);
        });
        await profilecar.getSignedUrl(options).then(results => {
          const url = results[0];
          let update;
          update = { profilecar: url };
          admin
            .firestore()
            .collection("drivers")
            .doc(doc.id)
            .update(update);
        });
      });
    });
});

exports.massive_notifications = functions.firestore.document("Ads/{uid}").onCreate(snapshot => {
  let data = snapshot.data();

  switch (data.who) {
    case "0":
      return admin
        .firestore()
        .collection("clients")
        .get()
        .then(querySnapshot => {
          let messages = [];

          querySnapshot.forEach(doc => {
            let token = doc.data()["pushDevices"][0];
            messages.push({
              to: token,
              sound: "default",
              title: data.title,
              body: data.message,
              channelId: "ads",
              priority: "high",
              data: {
                id: 0,
              },
            });
          });

          console.log("Enviando mensajes a clientes: ", messages);

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
    case "1":
      return admin
        .firestore()
        .collection("drivers")
        .get()
        .then(querySnapshot => {
          let messages = [];
          querySnapshot.forEach(doc => {
            let token = doc.data()["pushDevices"][0];
            messages.push({
              to: token,
              sound: "default",
              title: data.title,
              body: data.message,
              channelId: "ads",
              priority: "high",
              data: {
                id: 0,
              },
            });
          });

          console.log("Enviando mensajes a conductores: ", messages);

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
    case "2":
      return admin
        .firestore()
        .collection("clients")
        .get()
        .then(querySnapshot => {
          admin
            .firestore()
            .collection("drivers")
            .get()
            .then(driverquerySnapshot => {
              let messages = [];

              querySnapshot.forEach(doc => {
                let token = doc.data()["pushDevices"][0];
                messages.push({
                  to: token,
                  sound: "default",
                  title: data.title,
                  body: data.message,
                  channelId: "ads",
                  priority: "high",
                  data: {
                    id: 0,
                  },
                });
              });

              driverquerySnapshot.forEach(doc => {
                let token = doc.data()["pushDevices"][0];
                messages.push({
                  to: token,
                  sound: "default",
                  title: data.title,
                  body: data.message,
                  channelId: "ads",
                  priority: "high",
                  data: {
                    id: 0,
                  },
                });
              });

              console.log("Enviando mensajes a clientes y conductores:", messages);

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
  }
});
