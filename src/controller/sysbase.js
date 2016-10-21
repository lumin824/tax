'use strict';

import fs from 'fs';
import request from 'request';
import FileCookieStore from 'tough-cookie-filestore';
import uuid from 'node-uuid';

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
    return request.defaults({jar});
  }
}
