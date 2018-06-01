const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const knex = require('knex');
const bcrypt = require("bcrypt-nodejs");
const request = require("request");
const formidable = require("express-formidable");
const upload = require("express-fileupload");
const db = knex({
  client: 'pg',

  connection: {
    host : '127.0.0.1',
    user : 'postgres',
    password : '1234',
    database : 'music_app'
  },

});

const fs = require('fs');

app.use(cors());

app.use(bodyParser.json());

app.use(upload({
  abortOnLimit:false,
}));

app.get("/",(req,res)=>res.send("<h1>Hello World!</h1>"));

app.post("/register",(req,res)=>{
  const {email,name,password}=req.body;
  const hash = bcrypt.hashSync(password);
  db.transaction(trx=>{
    trx.insert({
      password: hash,
      email: email
    }).into("login").returning("email").then(loginEmail=>{
      return trx("users").returning("*").insert({email:loginEmail[0],name:name}).then(user=>{
        res.json(user[0]);
      })
    }).then(trx.commit).catch(trx.rollback)
  })
  .catch(err=>res.status(400).json("Unable to register"));



});

app.post("/login",(req,res)=>{
  const {email,password}=req.body;
  db("login").where({email:email}).select("*").then(loginInfo=>{
        if(loginInfo.length===0){
          res.json("Invalid email or password");
        }else{
          const isValid=bcrypt.compareSync(password, loginInfo[0].password);
          if(isValid){
            db("users").where({email:loginInfo[0].email}).select("*").then(response=>{
              res.json(response[0]);
            });



          }else{
            res.json("Invalid email or password");
          }
        }
  });
});

app.post('/upload', function(req, res) {

  if (!req.files)
    return res.status(400).send('No files were uploaded.');

  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let song = req.files.song;

  let fileName = req.body.title+"-"+Date.now();
  const path = `${__dirname}/uploads/${fileName}.wav`;
  const partialPath = `uploads/${fileName}.wav`;
  // Use the mv() method to place the file somewhere on your server
  console.log(req.files);
  song.mv(path, function(err) {
    if (err){
      return res.status(500).send(err);
    }else{
      db.transaction(trx=>{
        trx("songs").insert({
        song_name:req.body.title,
        song_path:partialPath,
        artist:req.body.username
        }).then(trx.commit).catch(trx.rollback)
      })
      .catch(err=>res.status(400).json("Unable to upload")).then(res.redirect("http://localhost:3001/"));

    }


  });
});

app.get("/show",(req,res)=>{

  db("songs").select("*").then(songs=>res.json(songs));
});
app.get("/stream",(req,res)=>{
  const path = req.query.path;

  console.log(req);
 const stat = fs.statSync(path)
 const fileSize = stat.size
 const range = req.headers.range

 if (range) {
   const parts = range.replace(/bytes=/, "").split("-")
   const start = parseInt(parts[0], 10)
   const end = parts[1]
     ? parseInt(parts[1], 10)
     : fileSize-1
   const chunksize = (end-start)+1
   const file = fs.createReadStream(path, {start, end})
   const head = {
     'Content-Range': `bytes ${start}-${end}/${fileSize}`,
     'Accept-Ranges': 'bytes',
     'Content-Length': chunksize,
     'Content-Type': 'audio/wav',
   }

   res.writeHead(206, head);
   file.pipe(res);
 } else {
   const head = {
     'Content-Length': fileSize,
     'Content-Type': 'audio/wav',
   }
   res.writeHead(200, head)
   fs.createReadStream(path).pipe(res)
 }

});


app.get("/search/:keyword",(req,res)=>{
  const {keyword} = req.params;
  db("songs").select("*").then(songs=>{
    const filteredSongs=songs.filter(song=>song.song_name.toLowerCase().includes(keyword.toLowerCase()));
    res.json(filteredSongs);
  });
});

app.post("/add",(req,res)=>{
  const {artist,song_name,name,song_path} = req.body;
  db("favorites").insert({name:name,artist:artist,song_name:song_name,song_path:song_path}).then(res.json("Song has been added to favorites"));
});

app.get("/get-my-favorites/:name",(req,res)=>{
  const {name}=req.params;
  db("favorites").where({name:name}).select("*").then(songs=>res.json(songs));
});

app.post("/delete-my-favorites",(req,res)=>{
  const {name,artist,song_name}=req.body;
  db("favorites").where({name:name,artist:artist,song_name:song_name}).del().catch(err=>res.json(err)).then(res.json("Song has been removed from favorites"));
});

app.get("/get-my-uploads/:name",(req,res)=>{
  const {name}=req.params;
  db("songs").where({artist:name}).select("*").then(songs=>res.json(songs));
});

app.post("/delete-my-uploads",(req,res)=>{
  const {artist,song_name,song_path}=req.body;
  fs.unlink(song_path, function(error) {
    if (error) {
        throw error;
    }
  });
  db("songs").where({artist:artist,song_name:song_name}).del().catch(err=>res.json(err)).then(res.json("Song has been deleted"));
  db("favorites").where({artist:artist,song_name:song_name}).del().catch(err=>res.json(err)).then(res.json("Song has been deleted"));

});

app.listen(3000,console.log("App listening at port 3000"));
