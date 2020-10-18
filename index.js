const express = require('express');
const cloudinary = require('cloudinary');
require('dotenv').config()
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const MongoClient = require('mongodb').MongoClient;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@programming-hero.eg1nk.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const {ObjectId} = require('mongodb');
const serviceAccount = require("./configs/volunteer-network-f167d-firebase-adminsdk-b0efm-16ed700b75.json");


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.API_KEY, 
    api_secret: process.env.API_SECRET 
  });


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIRE_URL
  });

const storage = multer.diskStorage({
    destination: (req, file, callback) =>{
        callback(null, 'uploads')
    },
    filename: (req, file, callback) =>{
        callback(null, file.fieldname+path.extname(file.originalname))
    }
})

const upload = multer({
    storage: storage
});

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true  });
client.connect(err => {
    const serviceCollection = client.db("volunteer-network").collection("services");
    const registrationCollection = client.db("volunteer-network").collection("registrations");

    app.post('/addService',upload.single('banner'), async (req, res) => {
        
        const result = await cloudinary.uploader.upload(req.file.path).catch(cloudError => console.log(cloudError));
        if(result){
            const serviceData = {...req.body, photo: result.secure_url};  
            serviceCollection.insertOne(serviceData)
            .then(result => {
                if(result.insertedCount < 0){
                    res.send({"status": "error","message": `<p className="text-danger">Data corrupted</p>`})
                }
                else{
                    res.send(result.ops[0]);
                }
            })
            .catch(dbError => console.log(dbError));
        }
        else{
            res.status(404).send('Upload Failed');
        }
    
    })

    app.get('/getEvents', (req, res) => {
        serviceCollection.find({})
        .toArray((err, documents) => {
            if(err) console.log(err);
            res.send(documents)
        })
    })

    app.get('/event/:id', (req, res) => {
        serviceCollection.find({ _id : ObjectId(req.params.id)})
        .toArray((err, documents) => {
            documents.map(doc => delete doc.photo);
            res.send(documents);
        })
    })

    app.post('/registration', (req, res) => {
        const registrationInfo = req.body;
        registrationCollection.insertOne(registrationInfo)
        .then((result) => {
            if(result.insertedCount > 0){
                res.send({"status": "success","message": `<p className="text-success">Data inserted!</p>`});
            }
            else{
                res.send({"status": "success","message": `<p className="text-success">Data inserted!</p>`})
            }
        })
    })

    app.get('/events', (req, res) => {
        const bearer = req.headers.authorization;
        if(bearer && bearer.startsWith('Bearer ')){
          const userToken = bearer.split(' ')[1];
          admin.auth().verifyIdToken(userToken)
          .then(function(decodedToken) {
            if(decodedToken.email == req.query.email){
              registrationCollection.find({email: req.query.email})
              .toArray((err, documents) => {
                  documents.map(doc => {
                      delete doc.photo;
                      delete doc.title;
                      delete doc.description;
                  })
                  res.send(documents);
              })
            }
            else{
              res.status(401).send('Un Authorized!!');
            }
          }).catch(function(error) {
            res.status(401).send('Un Authorized!!');
          });
        }
        else{
          res.status(401).send('Un Authorized!!');
        }
    })

    app.get('/getRegistrations', (req, res) => {
        const bearer = req.headers.authorization;
        if(bearer && bearer.startsWith('Bearer ')){
          const userToken = bearer.split(' ')[1];
          admin.auth().verifyIdToken(userToken)
          .then(function(decodedToken) {
                registrationCollection.find({})
                .toArray((err, documents) => {
                    res.send(documents);
                })
          }).catch(function(error) {
            res.status(401).send({"status":"Unautorized"});
          });
        }
        else{
          res.status(401).send({"status":"Unautorized"});
        }
    })

    app.get('/deleteRegistration/:id', (req, res) => {
        const id = req.params.id;
        const bearer = req.headers.authorization;
        if(bearer && bearer.startsWith('Bearer ')){
          const userToken = bearer.split(' ')[1];
          admin.auth().verifyIdToken(userToken)
          .then(function(decodedToken) {
                registrationCollection.deleteOne({_id: ObjectId(id)})
                .then(result => {
                    if(result.deletedCount > 0){
                        res.send(JSON.stringify({status: 'success', message: '<p className="text-success">Successfully deleted.</p>'}))
                    }else{
                        res.send(JSON.stringify({status: 'error', message: '<p className="text-danger">Something went wrong.</p>'}))
                    }
                })
          }).catch(function(error) {
            res.status(401).send({"status":"Unautorized 1"});
          });
        }
        else{
          res.status(401).send({"status":"Unautorized 1"});
        }
    })

});


app.get('/', (req, res) => {
    res.send('Hello Volunteer Network');
})

app.listen(process.env.PORT || 5000);