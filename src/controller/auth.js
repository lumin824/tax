'use strict';

import Base from './base.js';

export default class extends Base {

  loginAction(){

    if(this.isGet()){
      return this.display();
    }else{
      console.log(this.param());
      return this.success('ok');
    }
  }

  logoutAction(){
    return this.redirect('/auth/login');
  }

  joinAction(){
    return this.display();
  }

}
