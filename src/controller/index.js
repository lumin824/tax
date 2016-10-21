'use strict';

import Base from './base.js';

export default class extends Base {
  indexAction(){
    return this.display();
  }

  async uploadAction(){
    let { html:content, url:from } = this.param();
    await this.model('raw_data').add({
      content, from
    })
    return this.success('aaa');
  }
}
