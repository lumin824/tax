'use strict';

import Base from './base.js';

export default class extends Base {

  async loginAction(){

    if(this.isGet()){
      return this.display();
    }else{
      let { account, password, ret } = this.param();
      let user = await this.model('user').where({'username|mobile|email':account,password}).find();

      if(think.isEmpty(user)){
        return this.fail(600, '错误的用户名或密码');
      }else{
        await this.session('user', {
          ...user
        });
        return this.success({redirect:ret||'/admin'});
      }

    }
  }

  async logoutAction(){
    await this.session();
    return this.redirect('/auth/login');
  }

  joinAction(){
    return this.display();
  }

}
