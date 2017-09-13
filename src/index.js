/* global localStorage, fetch, noop */
import { ApolloClient } from 'apollo-client';
import { createNetworkInterface } from './network-interface';
import gql from 'graphql-tag';
import base64 from 'base-64';

const slice = (file, start, end) => {
    var slice = file.mozSlice ? file.mozSlice :
          file.webkitSlice ? file.webkitSlice :
          file.slice ? file.slice : noop;
      
    return slice.bind(file)(start, end);
};

class ZenttyClient {
    constructor(cfg = {}) {
        this.auth = null;
        if (cfg.sessionCode) {
            this.auth = base64.encode(cfg.sessionCode + ':');
        } else {
            this.auth = this.getStoredToken();
        }
        
        const uri = cfg.uri || null;
        
        if (uri === null) {
            throw new Error("EntityModelClient must contain a server uri");
        }
        
        const networkInterface = createNetworkInterface({uri});
        
        networkInterface.use([{
            applyMiddleware: (req, next) => {
                if (this.auth !== null) {
                    if (!req.options.headers) {
                        req.options.headers = {};  // Create the header object if needed.
                    }
                    req.options.headers.authorization = 'Basic ' + this.auth;
                }
                next();
            }
        }]);
        
        this.client = new ApolloClient({
            networkInterface
        });
    }
    
    getStoredToken () {
        try {
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem('auth_token');
            }
        } catch (ex) {
            console.error(ex);
        }
    }
    
    setStoredToken (token) {
        try {
            if (typeof localStorage !== 'undefined') {
                if (token === null) {
                    localStorage.removeItem('auth_token');
                } else {
                    localStorage.setItem('auth_token', token);
                }
            }
        } catch (ex) {
            console.error(ex);
        }
    }
    
    getSessionCode () {
        if (this.auth === null) {
            this.auth = this.getStoredToken();
        }
        
        return this.auth;
    }
    
    setSessionCode (sessionCode) {
        if (sessionCode === null) {
            this.auth = null;
            this.setStoredToken(null);
        } else {
            this.auth = base64.encode(sessionCode + ':');
            this.setStoredToken(this.auth);
        }
    }
    
    /**
     * params {
     *  username: String!
     *  email: String!
     *  name: String!
     *  password: String!
     * }
     */
    registerUser (params) {
        return new Promise((fulfill, reject) => {
            this.client.mutate({
                mutation: gql`
                    mutation registerUser($username: String!, $email: Email!, $name: String!, $password: String!) {
                        registerUser(
                            user: {
                                username: $username,
                                email: $email,
                                name: $name,
                                password: $password
                            }
                        ) {
                            user {
                                _id
                                username
                                email
                                name
                                active
                                registered
                                avatarUrl
                            }
                            errors {
                                field
                                message
                            }
                        }
                    }
                `,
                variables: {
                    ...params
                }
            }).then(result => {
                if (result.data.registerUser.errors !== null) {
                    reject(result.data.registerUser.errors);
                } else {
                    fulfill(result.data.registerUser.user);
                }
            }).catch(err => reject(err));
        });
    }
    
    /**
     * params {
     *   identifier: String!
     *   password: String!
     * }
     */
    loginUser (params) {
        return new Promise((fulfill, reject) => {
            this.client.mutate({
                mutation: gql`
                    mutation loginUser($identifier: String!, $password: String!) {
                        loginUser(
                            identifier: $identifier,
                            password: $password
                        ) {
                            loginSession {
                                sessionCode
                                createdAt
                                expires
                                ipAddress
                                userAgent
                            }
                            errors {
                                field
                                message
                            }
                        }
                    }
                `,
                variables: {
                    ...params
                }
            }).then(result => {
                if (result.data.loginUser.errors !== null) {
                    reject(result.data.loginUser.errors);
                } else {
                    const loginSession = result.data.loginUser.loginSession;
                    this.setSessionCode(loginSession.sessionCode);
                    fulfill(loginSession);
                }
            }).catch(err => reject(err));
        });
    }
    
    getUser () {
        return new Promise((fulfill, reject) => {
            this.client.query({
                fetchPolicy: 'network-only',
                query: gql`
                    query {
                        getUser {
                            _id
                            username
                            email
                            name
                            active
                            registered
                            avatarUrl
                        }
                    }
                `
            }).then(result => {
                fulfill(result.data.getUser);
            }).catch(err => reject(err));
        });
    }
    
    logoutUser (sessionCode = null) {
        return new Promise((fulfill, reject) => {
            this.client.mutate({
                mutation: gql`
                    mutation logoutUser($sessionCode: String) {
                        logoutUser(
                            sessionCode: $sessionCode
                        )
                    }
                `,
                variables: {
                    sessionCode
                }
            }).then(result => {
                const success = result.data.logoutUser;
                
                if (success === true) {
                    this.setSessionCode(null);
                }
                
                fulfill(success);
            }).catch(err => reject(err));
        });
    }
    
    /**
     * params {
     *   type: String!
     *   title: String
     *   body: String
     *   metadata: Object
     *   scopeID: String
     *   parentID: String
     * }
     */
    createEntity (params) {
        return new Promise((fulfill, reject) => {
            this.client.mutate({
                mutation: gql`
                    mutation createEntity($type: String!, $title: String, $body: RichContent, $metadata: JSON, $scopeID: String, $parentEntityID: String) {
                        createEntity(
                            type: $type,
                            entity: {
                                title: $title,
                                body: $body,
                                metadata: $metadata
                            },
                            scopeID: $scopeID,
                            parentEntityID: $parentEntityID
                        ) {
                            _id
                            title
                            body
                            metadata
                            type
                            createdAt
                            createdBy {
                                _id
                                name
                                username
                                active
                                registered
                                avatarUrl
                            }
                            archived
                        }
                    }
                `,
                variables: {
                    ...params
                }
            }).then(result => {
                fulfill(result.data.createEntity);
            }).catch(err => reject(err));
        });
    }
    
    /**
     * params {
     *      id: String!
     * }
     */
    getEntity (params) {
        return new Promise((fulfill, reject) => {
            this.client.query({
                query: gql`
                    query getEntity($id: String!) {
                        getEntity(
                            id: $id
                        ) {
                            _id
                            title
                            body
                            metadata
                            type
                            createdAt
                            createdBy {
                                _id
                                name
                                username
                                active
                                registered
                                avatarUrl
                            }
                            archived
                        }
                    }
                `,
                variables: {
                    ...params
                }
            }).then(result => {
                fulfill(result.data.getEntity);
            }).catch(err => reject(err));
        });
    }
    
    /**
     * params {
     *   id: String!
     *   title: String
     *   body: String
     *   metadata: Object
     * }
     */
    modifyEntity (params) {
        return new Promise((fulfill, reject) => {
            this.client.mutate({
                mutation: gql`
                    mutation modifyEntity($id: String!, $title: String, $body: RichContent, $metadata: JSON) {
                        modifyEntity(
                            id: $id,
                            entity: {
                                title: $title,
                                body: $body,
                                metadata: $metadata
                            }
                        ) {
                            _id
                            title
                            body
                            metadata
                            type
                            createdAt
                            createdBy {
                                _id
                                name
                                username
                                active
                                registered
                                avatarUrl
                            }
                            archived
                        }
                    }
                `,
                variables: {
                    ...params
                }
            }).then(result => {
                fulfill(result.data.modifyEntity);
            }).catch(err => reject(err));
        });
    }
    
    /**
     * params {
     *     parentID: String!
     *     childType: String
     *     limit: Int
     *     offset: Int
     * }
     */
    getEntities (params) {
        return new Promise((fulfill, reject) => {
            this.client.query({
                fetchPolicy: 'network-only',
                query: gql`
                    query getEntities ($parentID: String!, $childType: String, $limit: Int = 0, $offset: Int = 0) {
                        getEntities (
                            parentID: $parentID,
                            childType: $childType,
                            limit: $limit,
                            offset: $offset
                        ) {
                            result {
                                total
                                limit
                                offset
                            }
                            items {
                                _id
                                title
                                metadata
                                file {
                                    filename
                                    filesize
                                    status
                                }
                                type
                                createdAt
                                createdBy {
                                    _id
                                    username
                                    name
                                    registered
                                    active
                                    avatarUrl
                                }
                            }
                        }
                    }
                `,
                variables: {
                    ...params
                }
            }).then(result => {
                fulfill(result.data.getEntities);
            }).catch(err => reject(err));
        });
    }
    
    /**
     * params {
     *   soureEntityID: String!
     *   relationship: String!
     *   direction: [source|target] default target
     *   limit: Int
     *   offset: Int
     * }
     */
    getRelatedEntities (params) {
        return new Promise((fulfill, reject) => {
            this.client.query({
                fetchPolicy: 'network-only',
                query: gql`
                    query getRelatedEntities ($sourceEntityID: String!, $relationship: String!, $direction: String = "target", $limit: Int = 0, $offset: Int = 0) {
                        getRelatedEntities (
                            sourceEntityID: $sourceEntityID,
                            relationship: $relationship,
                            direction: $direction,
                            limit: $limit,
                            offset: $offset
                        ) {
                            result {
                                total
                                limit
                                offset
                            }
                            items {
                                _id
                                title
                                metadata
                                file {
                                    filename
                                    filesize
                                    status
                                }
                                type
                                createdAt
                                createdBy {
                                    _id
                                    username
                                    name
                                    registered
                                    active
                                    avatarUrl
                                }
                            }
                        }
                    }
                `,
                variables: {
                    ...params
                }
            }).then(result => {
                fulfill(result.data.getRelatedEntities);
            }).catch(err => reject(err));
        });
    }
    
    /**
     * params {
     *     entityID: String!
     *     filename: String!
     *     type: String
     *     filesize: Int!
     * }
     */
    prepareFileUpload (params) {
        return new Promise((fulfill, reject) => {
            this.client.mutate({
                mutation: gql`
                    mutation prepareFileUpload($entityID: String!, $filename: String!, $type: String, $filesize: Int!) {
                        prepareFileUpload(
                            entityID: $entityID,
                            filename: $filename,
                            type: $type,
                            filesize: $filesize
                        )
                    }
                `,
                variables: {
                    ...params
                }
            }).then(result => {
                fulfill(result.data.prepareFileUpload);
            }).catch(err => reject(err));
        });
    }
    
    /**
     * params {
     *    entityID: String!
     *    chunk: Buffer
     * }
     */
    appendFileChunk (params) {
        return new Promise((fulfill, reject) => {
            this.client.mutate({
                mutation: gql`
                    mutation appendFileChunk($entityID: String!) {
                        appendFileChunk(
                            entityID: $entityID
                        )
                    }
                `,
                variables: {
                    entityID: params.entityID,
                    _chunk: params.chunk
                }
            }).then(result => {
                fulfill(result.data.appendFileChunk);
            }).catch(err => reject(err));
        });
    }
    
    _uploadFileChunk (entityID, file, start, chunkSize, fn) {
        const end = Math.min(start + chunkSize, file.size);
        const chunk = slice(file, start, end);
        
        this.appendFileChunk({
            entityID: entityID,
            chunk: chunk
        }).then((isComplete) => {
            const progress = {
                complete: isComplete,
                bytesUploaded: end,
                totalBytes: file.size
            };
            
            fn(null, progress);
            
            if (!isComplete) {
                this._uploadFileChunk(entityID, file, end, chunkSize, fn);
            }
        }).catch(err => fn(err));
    }
    
    /**
     * params {
     *    entityID: String!
     *    file: File
     * }
     */
    uploadFile (params, fn = () => {}) {
        return new Promise((fulfill, reject) => {
            const id = params.entityID || null;
            const file = params.file || null;
            
            if (id === null) {
                reject('Entity ID missing');
            }
            
            if (file === null) {
                reject('File missing');
            }
            
            // Prepare the file
            this.prepareFileUpload({
                entityID: params.entityID,
                filename: file.name,
                filesize: file.size
            }).then(() => {
                // The file has been prepared, lets start uploading the chunks
                this._uploadFileChunk(id, file, 0, 200 * 1024, (err, progress) => {
                    if (err) {
                        reject(err);
                    } else {
                        // Share the progress
                        fn(progress);
                        
                        if (progress.complete) {
                            fulfill();
                        }
                    }
                });
            }).catch(err => reject(err));
        });
    }
}

if (typeof window !== 'undefined') {
    window.ZenttyClient = ZenttyClient;
}

export default ZenttyClient;