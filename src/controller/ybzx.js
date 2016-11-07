'use strict';

import Base from './base.js';
import request from 'request';
import _ from 'lodash';
import cheerio from 'cheerio';

export default class extends Base {

  indexAction(){
    let result = this.model('company').getList();
    this.assign('result', result);
    return this.display();
  }

  async findcc(keyword){
    let form = {
      keyword,searchtype:'0',objectType:'2',areas:'',creditType:'',
      dataType:'1',areaCode:'',templateId:'',exact:'0',page:'1'
    };
    let headers = { 'User-Agent':'request', 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' };

    let fetchFunc = (page)=> new Promise((resolve, reject)=>{
      request.post('http://www.creditchina.gov.cn/credit_info_search',{
        form:{...form, page},headers
      },(error, response, body)=>{
        if(error) reject(error);
        else resolve(JSON.parse(body));
      });
    });

    let result = (await fetchFunc('1')).result.results;
    return result.length && result[0];
  }

  async detailAction(){
    let { id } = this.param();
    let list = this.model('company').getList();

    let obj = _.find(list, {id});
    if(obj){
      if(obj.type == 'jsgs'){
        obj.cc = await this.findcc(obj.name);
        console.log(obj.cc);
        this.assign(obj);
        return this.display('jsgs_show');
      }
    }

    return this.display();
  }
}
