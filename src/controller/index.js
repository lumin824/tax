'use strict';

import Base from './base.js';

export default class extends Base {
  indexAction(){
    return this.display();
  }

  uploadAction(){
    console.log(this.param());
    return this.success('aaa');
  }
}
