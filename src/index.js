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

const createClient = (uri, auth) => {
    const networkInterface = createNetworkInterface({uri});
    
    networkInterface.use([{
        applyMiddleware: (req, next) => {
            if (auth !== null) {
                if (!req.options.headers) {
                    req.options.headers = {};  // Create the header object if needed.
                }
                req.options.headers.authorization = 'Basic ' + auth;
            }
            next();
        }
    }]);
    
    return new ApolloClient({
        fetchPolicy: 'network-only',
        networkInterface
    });
};

class ZenttyClient {

    
    constructor(cfg = {}) {
        this.auth = null;
        if (cfg.sessionCode) {
            this.auth = base64.encode(cfg.sessionCode + ':');
        } else {
            this.auth = this.getStoredToken();
        }
        
        this.uri = cfg.uri || null;
        
        if (this.uri === null) {
            throw new Error("EntityModelClient must contain a server uri");
        }
        
        this.client = createClient(this.uri, this.auth);
    }
    
    // Since apollo-client has no way to clear the cache, we can free memory by
    // creating a new apollo client
    clearCache () {
        this.client = createClient(this.uri, this.auth);
    }
    
    getStoredToken () {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('auth_token') || null;
        } else {
            return null;
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
    
    getAuth () {
        if (this.auth === null) {
            this.auth = this.getStoredToken();
        }
        
        return this.auth;
    }
    
    setAuth (authCode) {
        this.auth = authCode;
        this.setStoredToken(this.auth);
    }
    
    setSessionCode (sessionCode) {
        if (sessionCode === null) {
            this.auth = null;
            this.setStoredToken(null);
        } else {
            this.auth = base64.encode(sessionCode + ':');
            this.setStoredToken(this.auth);
        }
        this.clearCache();
    }
    
    mutate (mutation) {
        return this.client.mutate(mutation);
    }
    
    query (query) {
        return this.client.query(query);
    }
    
    /**
     * params {
     *  username: String!
     *  email: String!
     *  name: String!
     *  password: String!
     * }
     */
    async registerUser (params) {
        const { data: { registerUser: user }} = await this.client.mutate({
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
                        _id
                        username
                        email
                        name
                        active
                        registered
                        avatarUrl
                    }
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        return user;
    }
    
    /**
     * params {
     *   identifier: String!
     *   password: String!
     * }
     */
    async loginUser (params) {
        const { data: { loginUser: loginSession }} = await this.client.mutate({
            mutation: gql`
                mutation loginUser($identifier: String!, $password: String!) {
                    loginUser(
                        identifier: $identifier,
                        password: $password
                    ) {
                        sessionCode
                    }
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        this.setSessionCode(loginSession.sessionCode);
        
        return loginSession;
    }
    
    async getUser (params = {}) {
        const { data: { getUser: user }} = await this.client.query({
            query: gql`
                query getUser {
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
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        return user;
    }
    
    async logoutUser (params) {
        await this.client.mutate({
            mutation: gql`
                mutation logoutUser($sessionCode: String) {
                    logoutUser(
                        sessionCode: $sessionCode
                    )
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        this.setSessionCode(null);
    }
    
    async createEntity (params = {}) {
        const { data: { createEntity: entity }} = await this.client.mutate({
            mutation: gql`
                mutation createEntity($type: String!, $entity: EntityInputData!, $scopeID: String, $parentEntityID: String, $placeBeforeID: String, $placeAfterID: String) {
                    createEntity(
                        type: $type,
                        entity: $entity,
                        scopeID: $scopeID,
                        parentEntityID: $parentEntityID,
                        placeBeforeID: $placeBeforeID,
                        placeAfterID: $placeAfterID
                    ) {
                        _id
                        title
                        body
                        metadata
                        type
                        createdAt
                        archived
                    }
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        return entity;
    }
    
    async getEntity (params = {}) {
        const { data: { getEntity: entity }} = await this.client.query({
            query: gql`
                query getEntity ($id: String!) {
                    getEntity (
                        id: $id
                    ) {
                        _id
                        title
                        body
                        metadata
                        type
                        createdAt
                        archived
                    }
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        return entity;
    }
    
    async modifyEntity (params = {}) {
        const { data: { modifyEntity: entity }} = await this.client.mutate({
            mutation: gql`
                mutation modifyEntity($id: String!, $entity: EntityInputData, $placeAfterID: String, $placeBeforeID: String) {
                    modifyEntity(
                        id: $id,
                        entity: $entity,
                        placeAfterID: $placeAfterID,
                        placeBeforeID: $placeBeforeID
                    ) {
                        _id
                        title
                        body
                        metadata
                        type
                        createdAt
                        archived
                    }
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        return entity;
    }
    
    async relateEntity (params = {}) {
        const { data: { relateEntity: success }} = await this.client.mutate({
            mutation: gql`
                mutation relateEntity($sourceEntityID: String!, $targetEntityID: String!, $relationship: String!, $metadata: JSON, $placeAfterID: String, $placeBeforeID: String) {
                    relateEntity(
                        sourceEntityID: $sourceEntityID,
                        targetEntityID: $targetEntityID,
                        relationship: $relationship,
                        metadata: $metadata,
                        placeAfterID: $placeAfterID,
                        placeBeforeID: $placeBeforeID
                    )
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        return success;
    }
    
    async unrelateEntity (params = {}) {
        const { data: { unrelateEntity: success }} = await this.client.mutate({
            mutation: gql`
                mutation unrelateEntity($sourceEntityID: String!, $targetEntityID: String!, $relationship: String!) {
                    unrelateEntity(
                        sourceEntityID: $sourceEntityID,
                        targetEntityID: $targetEntityID,
                        relationship: $relationship
                    )
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        return success;
    }
    
    async getEntities (params = {}) {
        const { data: { getEntities: entities }} = await this.client.query({
            query: gql`
                query getEntities ($parentID: String!, $childType: String, $limit: Int, $offset: Int) {
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
                            type
                        }
                    }
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        return entities;
    }
    
    async getRelatedEntities (params = {}) {
        const { data: { getRelatedEntities: entities }} = await this.client.query({
            query: gql`
                query getRelatedEntities ($sourceEntityID: String!, $relationship: String!, $type: String, $direction: String, $limit: Int, $offset: Int) {
                    getRelatedEntities (
                        sourceEntityID: $sourceEntityID,
                        relationship: $relationship,
                        type: $type,
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
                            targetEntity {
                                _id
                                title
                                type
                            }
                            position
                        }
                    }
                }
            `,
            variables: {
                ...params
            },
            fetchPolicy: 'network-only'
        });
        
        return entities;
    }
    
    /**
     * params {
     *     entityID: String!
     *     filename: String!
     *     type: String
     *     filesize: Int!
     * }
     */
    async prepareFileUpload (params) {
        const {data: {prepareFileUpload: success}} = await this.client.mutate({
            fetchPolicy: 'network-only',
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
        });
        return success;
    }
    
    /**
     * params {
     *    entityID: String!
     *    chunk: Buffer
     * }
     */
    async appendFileChunk (params) {
        const {data: {appendFileChunk: isComplete}} = await this.client.mutate({
            fetchPolicy: 'network-only',
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
        });
        return isComplete;
    }

    /**
     * params {
     *    entityID: String!
     *    file: File
     * }
     */
    async uploadFile ({entityID = null, file = null}, fn = () => {}) {
        if (entityID === null) {
            throw 'Entity ID missing';
        }
        
        if (file === null) {
            throw 'File missing';
        }
        
        // Prepare the file
        await this.prepareFileUpload({
            entityID: entityID,
            filename: file.name,
            filesize: file.size
        });
        
        let done = false;
        let start = 0;
        let end, chunk, progress;
        const chunkSize = 200 * 1014;
        while (!done) {
            end = Math.min(start + chunkSize, file.size);
            chunk = slice(file, start, end);
            // Do the upload
            done = await this.appendFileChunk({entityID, chunk});
            
            progress = {
                complete: done,
                bytesUploaded: end,
                totalBytes: file.size
            };
            
            fn(progress); // Call out notification
        }
    }
}

if (typeof window !== 'undefined') {
    window.ZenttyClient = ZenttyClient;
}

export default ZenttyClient;