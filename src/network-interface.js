/* global fetch */
import { HTTPFetchNetworkInterface, printAST } from 'apollo-client';
import FormData from 'isomorphic-form-data';

export class UploadHTTPFetchNetworkInterface extends HTTPFetchNetworkInterface {
    fetchFromRemoteEndpoint({ request, options }) {
        //if (request.variables && request.variables._chunk) {
            const formData = new FormData();
            formData.append('operationName', request.operationName || '');
            
            //formData.append('operations', JSON.stringify(request));
            if (request.variables._chunk) {
                formData.append('chunk', request.variables._chunk);
            }
            
            formData.append('debugName', JSON.stringify(request.debugName || ''));
            formData.append('query', printAST(request.query));
            
            const variables = {...request.variables};
            delete variables._chunk;
            formData.append('variables', JSON.stringify(variables));
            
            return fetch(this._uri, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                ...options
            });
        //}

        // Standard fetch method fallback
        //return super.fetchFromRemoteEndpoint({ request, options })
    }
}

export function createNetworkInterface({ uri, opts = {} }) {
    return new UploadHTTPFetchNetworkInterface(uri, opts)
}