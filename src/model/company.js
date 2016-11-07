'use strict';
/**
 * model
 */

import _ from 'lodash';

let objList = [];
export default class extends think.model.base {

  add(obj){
    let { id } = obj;
    if(id){
      objList = _.filter(objList, o=>o.id!=id);
      objList.push(obj);
    }
  }

  getList(){
    return objList;
  }
}
