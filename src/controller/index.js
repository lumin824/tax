'use strict';

import Base from './base.js';
import moment from 'moment';

export default class extends Base {
  async indexAction(){

    let { content } = await this.model('article').where({code:'home'}).find();
    this.assign({content});
    return this.display();
  }

  areaAction(){
    return this.display();
  }

  async uploadAction(){
    let body = await this.http.getPayload();
    let { html:content, url:from } = JSON.parse(body);
    let ip = this.ip();
    await this.model('raw_data').add({
      content, from, ip, create_time: moment().unix()
    })
    return this.success('aaa');
  }
}
