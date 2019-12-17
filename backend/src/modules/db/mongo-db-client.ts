import {MongoClient, MongoClientOptions, ObjectId, UpdateWriteOpResult} from 'mongodb';
import {injectable} from 'inversify';
import {User, UserToken} from '../../types/types';
import CredentialHelper from './credential-helper';
import connectorInstance from "./mongo-connector-config";

@injectable()
export default class MongoDBClient {
    private connectionMiddleware: MongoClient;
    private mongoClient: MongoClient = connectorInstance();

    get connectionCreator(): MongoClient {
        return this.mongoClient;
    }

    public connect(): Promise<void | string> {
        return this.mongoClient.connect()
            .then((mongoClient: MongoClient) => this.connectionMiddleware = mongoClient)
            .then(() => this.setupDBIndexes())
            .catch((e: Error) => console.log('Could not connect to mongo server: ' + e));
    }

    public getCollectionOfCharities() {
        return this.connectionMiddleware.db('organizations').collection('charities').find().toArray()
    }

    public getStatisticsCollection(params: string): Promise<unknown> {
        switch (params) {
            case 'internet-access':
                const cursor = this.connectionMiddleware.db('map-statistics').collection('internet-access').find({}, {
                    projection: {
                        type: true,
                        features: true,
                        _id: false
                    }
                });

                return cursor.next();
            default:
                return this.connectionMiddleware.db('map-statistics').collection('internet-access').find({}).next();
        }
    }

    public async addUser({firstName, lastName, avatarColor, email, password, emailVerified}: User) {
        const passwordHashed: string = await CredentialHelper.hash(password);
        return this.connectionMiddleware.db('users').collection<User>('email').insertOne(
            {firstName, lastName, avatarColor, email, emailVerified, password: passwordHashed}
        );
    }

    public async addEmailVerificationToken({uid, token, expireAt}: Partial<UserToken>) {
        // If you add a expireAt field in a mongoDB document - the document gets automatically deleted after the incoming expiration
        // for creation of an email-verification token in the db we will use update one with the option {upsert: true}
        //  Update will look for the document that matches your query, then it will modify the fields you want and then,
        //  you can tell it {upsert: true} if you want to insert if no document matches your query.
        // source: https://stackoverflow.com/questions/24122981/how-to-stop-insertion-of-duplicate-documents-in-a-mongodb-collection
        return this.connectionMiddleware.db('users').collection<UserToken>('email-verification').updateOne(
            {uid}, {'$set': {uid, token, expireAt}}, {upsert: true}
        );
    }

    public async findUserByEmail(email: string) {
        return this.connectionMiddleware.db('users').collection<User>('email').findOne({email});
    }

    public async updateUser(email: string, toUpdate: Partial<User>): Promise<UpdateWriteOpResult> {
        return this.connectionMiddleware.db('users').collection<User>('email').updateOne({email: email}, {'$set': toUpdate});
    }

    public async findUserByID(id: string) {
        return this.connectionMiddleware.db('users').collection<User>('email').findOne({'_id': new ObjectId(id)} as any);
    }

    public async validatedSession(uid: string, sid: string) {
        // An mongoDB-Id is a 12 Bytes long string - The session cookie of a 24 Bytes string
        // A session id is looking like: s%3Avvui1vsldkCor7CE-E0aU8Fmpg_z-f4c.3c43w5lavEdUmfjvzkubCXxy7VctVp4XaBhs7sj11%2F0
        // A db-id is composed of the letter between s:(urlEncoded: s%3A) - string - .
        const mappedId = sid.replace(decodeURIComponent('s%3A'), '').split('.')[0];
        const user: any = await this.connectionMiddleware.db('users').collection<User>('sessions').findOne({"_id": mappedId});
        return user && uid === JSON.parse(user.session).user.uid;
    }

    private async setupDBIndexes() {
        await this.connectionMiddleware.db('users').collection('email').createIndex({'email': 1}, {unique: true});
        return this.connectionMiddleware.db('users').collection('email-verification').createIndex({'uid': 1}, {unique: true});
    }
}
