'use strict';

import Base from './base.js';
import fs from 'fs';

export default class extends Base {
  /**
   * index action
   * @return {Promise} []
   */
  indexAction(){
    //auto render template file index_index.html
    return this.display();
  }

  downloadAction(){
    let { hash } = this.param();
    return this.download(think.RUNTIME_PATH + '/archive/' + hash, 'application/pdf', encodeURIComponent(hash+'.pdf'));
  }

  viewAction(){
    let { hash, type } = this.param();
    fs.createReadStream(think.RUNTIME_PATH + '/archive/' + hash).pipe(this.http.res);
  }
}
