'use strict';

import Base from './base.js';

export default class extends Base {
  indexAction(){
    return this.display();
  }

  async uploadAction(){
    let body = await this.http.getPayload();
    let { html:content, url:from } = JSON.parse(body);
    await this.model('raw_data').add({
      content, from
    })
    return this.success('aaa');
  }
}
