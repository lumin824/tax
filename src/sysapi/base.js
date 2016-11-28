import request from 'request';

export default class {
  constructor(){
    this.httpClient = request.defaults({jar:request.jar()});
  }
  async httpGet(...args){
    return new Promise((resolve, reject) => {
      this.httpClient.get(...args, (error, response, body) => {
        error ? reject(error) : resolve({response, body});
      });
    });
  }
  async httpPost(...args){
    return new Promise((resolve, reject) => {
      this.httpClient.post(...args, (error, response, body) => {
        error ? reject(error) : resolve({response, body});
      });
    });
  }
}
