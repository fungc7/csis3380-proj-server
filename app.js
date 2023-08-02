import express, { response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { MongoClient, ServerApiVersion } from "mongodb";

const app = express();
const corsOptions = {
    origin: '*',
    credentials: true,            //access-control-allow-credentials:true
    optionSuccessStatus: 200,
}

const USER = process.env.USER;
const PASSWORD = process.env.PASSWORD;
const DOMAIN = process.env.MONGODB_DOMAIN;
const port = process.env.PORT;

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

const uri = `mongodb+srv://${USER}:${PASSWORD}@${DOMAIN}/?retryWrites=true&w=majority`;
const dbname = "csis3380";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function getAvgRating(mongoClient) {
    const avgRating = await mongoClient.db(dbname)
        .collection("review").aggregate([
            {
                $group: {
                    _id: '$movieId',
                    avgRating: { $avg: '$rating' }
                }
            }
        ]).toArray();
    return avgRating[0];
}

async function updateAvgRating(mongoClient, id, newAvgRating) {
    console.log(id, newAvgRating);
    const res = await mongoClient.db(dbname)
        .collection("movies").updateOne(
            { movieId: id },
            { $set: { avgRating: newAvgRating } },
            { upsert: true }
        )
    return res;
}

app.get("/", async (req, res) => {
    try {
        await client.connect();
        const data = await client.db(dbname)
            .collection("movies")
            .find()
            .toArray();
        res.json(data);
    }
    catch (error) {
        res.json({err: error})
        res.status(500).end();
    }
});

app.get("/movie/:id", async (req, res) => {
    console.log(req.params.id);
    try {
        await client.connect();
        const data = await client.db(dbname)
            .collection("movies")
            .find({ movieId: parseInt(req.params.id) })
            .toArray();
        res.json(data);
    }
    catch (error) {
        res.status(500).end();
    }
})

app.get("/movie/:id/review", async (req, res) => {
    console.log(req.params.id);
    try {
        await client.connect();
        const data = await client.db(dbname)
            .collection("review")
            .find({ movieId: parseInt(req.params.id) })
            .toArray();
        res.json(data);
    }
    catch (error) {
        res.status(500).end();
    }
})

app.post("/movie/:id/review", async (req, res) => {
    let resp = {
        posted: false,
        message: ""
    }
    console.log(req.body);
    try {
        await client.connect();
        const res = await client.db(dbname)
            .collection("review")
            .insertOne({
                username: req.body.username,
                movieId: parseInt(req.body.movieId),
                content: req.body.content,
                rating: parseInt(req.body.rating),
                reviewTimestamp: req.body.timestamp
            })
        const avgRating = await getAvgRating(client);
        const updateRes = await updateAvgRating(client, avgRating._id, avgRating.avgRating)
        console.log(res);
        console.log(avgRating);
        console.log(updateRes);
        resp.posted = true;
        resp.message = "Posted review";
    }
    catch (error) {
        res.status(500);
        resp.message = "Failed to post review";
    }
    finally {
        res.json(resp)
    }
})

app.post("/login", async (req, res) => {
    const failMsg = "Incorrect Username or Password."
    let response = {
        authRes: false,
        message: ""
    };
    try {
        await client.connect();
        const data = await client.db(dbname)
            .collection("users")
            .find({ username: req.body.username })
            .toArray();
        if (data.length == 1) {
            if (data[0].password === req.body.password) {
                response.authRes = true;
                response.message = "Login successful"
            }
            else {
                response.message = failMsg;
            }
        }
        else if (data.length == 0) {
            res.status(401)
            response['message'] = failMsg;
        } 
        else {
            res.status(500)
            response['message'] = "More than one user with same name";
        }
        res.json(response);
    }
    catch (error) {
        res.status(500).end();
    }
});

app.post("/createaccount", async (req, res) => {
    let resp = {
        created: false,
        message: ""
    }
    console.log(req.body);
    try {
        await client.connect();
        const res = await client.db(dbname)
            .collection("users")
            .insertOne({
                username: req.body.username,
                password: req.body.password
            })
        console.log(res);
        resp.created = true;
        resp.message = "Successfully created account.";
    }
    catch (error) {
        resp.message = "Failed creating account.";
    }
    finally {
        res.json(resp);
    }
})

app.get("/test", (req, res) => {
    res.json({message: "Hello World."});
})

app.listen(port, () => {
    console.log(`App running on ${port}`);
});