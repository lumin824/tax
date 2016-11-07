'use strict';

import fs from 'fs';
import request from 'request';
import FileCookieStore from 'tough-cookie-filestore';
import uuid from 'node-uuid';


import DbCookieStore from '../ext/dbcookiestore';


export default class extends think.controller.base {

  async getOrCreateHttpClient(){
    let token = await this.session('token');
    if(!token){
      token = uuid.v4();
      this.session('token', token);
    }

    let cookiePath = think.RUNTIME_PATH + `/scgs_cookie_${token}.json`;
    if(!fs.existsSync(cookiePath)){
      fs.writeFileSync(cookiePath, '');
    }
    let jar = request.jar(new FileCookieStore(cookiePath));
    // let store = new DbCookieStore(this);
    // let jar = request.jar(store);
    return request.defaults({jar});
  }

  async httpPost(...args){
    if(!this.httpClient) this.httpClient = this.getOrCreateHttpClient();
    return new Promise((resolve, reject)=>{
      this.httpClient.post(...args, (error, response, body)=>{
        if(error) reject(error);
        else resolve({response, body});
      });
    });
  }

  async httpGet(...args){
    if(!this.httpClient) this.httpClient = await this.getOrCreateHttpClient();
    return new Promise((resolve, reject)=>{
      this.httpClient.get(...args, (error, response, body)=>{
        if(error) reject(error);
        else resolve({response, body});
      });
    });
  }
}
