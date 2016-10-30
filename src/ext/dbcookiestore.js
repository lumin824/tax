'use strict';

import _ from 'lodash';
import ToughCookie, {
  canonicalDomain,
  permuteDomain,
  permutePath,
  Cookie
} from 'tough-cookie';

export default class  {
  synchronous = true;

  constructor(ctrl){
    this.model = ctrl.model('cookie');
  }
  async findCookies(domain, path, cb){
    console.log('------findCookies1------');
    console.log([domain, path]);
    let list = await this.model.where({
      domain: ['IN', permuteDomain(domain)],
      path: ['IN', permutePath(path)]
    }).select();
    cb(null, _.map(list, o=>itemToCookie(o)));
  }
  async findCookie(domain, path, key, cb){
    console.log('------findCookie------');
    console.log([domain, path, key]);

    let item = await this.model.where({
      domain: ['IN', permuteDomain(domain)],
      path, key
    }).find();
    if(think.isEmpty(item)){
      cb(null, itemToCookie(item));
    }else{
      cb();
    }
  }
  async putCookie(cookie, cb){
    let { domain, path, key, value, expires } = cookie;
    let item = await this.model.where({domain, path, key}).find();

    if(expires == 'Infinity') expires = null;
    if(think.isEmpty(item)){
      this.model.add({domain, path, key, value, expires});
    }else{

      this.model.where({id:item.id}).update({value, expires});
    }

    console.log('------putCookie------');
    console.log(cookie);
    cb();
  }

  itemToCookie(item){
    return new Cookie({
      ...item,
      expires: item.expires ? item.expires : 'Infinity',
      domain: canonicalDomain(item.domain),
      httpOnly: false,
      creation: null,
      lastAccessed: null,
      hostOnly: false,
    });
  }
}
