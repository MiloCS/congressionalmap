fetch("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/0/query?where=STATE='25'+AND+CD119='04'&outFields=*&f=geojson")
  .then(res => res.json())
  .then(data => console.log(data.features[0].geometry.type))
  .catch(console.error);
