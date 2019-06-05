fetch("https://us-central1-taxiapp-sinewave.cloudfunctions.net/location/", {
  method: "post",
  body: { lat: 100, lng: 100 },
})
  .then(res => res.json())
  .then(Response => {
    console.log("success:", JSON.stringify(Response));
  })
  .catch(error => console.error("Error:", error));
