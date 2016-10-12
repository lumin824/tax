'use strict';

import Base from './base.js';

import request from 'request';
import fs from 'fs';
import FileCookieStore from 'tough-cookie-filestore';
import cheerio from 'cheerio';
import _ from 'lodash';
import uuid from 'node-uuid';

let getOrCreateHttpClient = (token) => {
  let cookiePath = think.RUNTIME_PATH + `/scgs_cookie_${token}.json`;
  if(!fs.existsSync(cookiePath)){
    fs.writeFileSync(cookiePath, '');
  }
  let jar = request.jar(new FileCookieStore(cookiePath));
  return request.defaults({jar});
};

let getJKPZ = (httpClient, p) => new Promise((resolve, reject)=>{
  httpClient.get('http://wsbs.sc-n-tax.gov.cn/invoice/jkpz.htm', {qs:{p}}, (error, response, body)=>{
    if(error) reject(error);
    let $ = cheerio.load(body);
    resolve(_.map($('#theObjTable tbody tr'), o=>{
      let tds = $('td', o);
      if(_.size(tds) == 1) return {};
      return {
        pzhm: tds.eq(0).text(),
        sz: tds.eq(1).text(),
        sm: tds.eq(2).text(),
        zsl: tds.eq(3).text(),
        sssq: tds.eq(4).text(),
        sjje: tds.eq(5).text()
      }
    }));
  });
});

export default class extends Base {

  async indexAction(){
    let token = await this.session('token');
    if(!token){
      token = uuid.v4();
      this.session('token', token);
    }
    let httpClient = getOrCreateHttpClient(token);
    if(this.isAjax()){
      let { username:userName, password, captcha:vcode } = this.param();
      let form = {userName, password, vcode, dlfs:1 };
      let result = await new Promise((resolve, reject)=>{
        httpClient.post('http://wsbs.sc-n-tax.gov.cn/op_login.htm', {form}, (error, response, body)=>{
          if(error)reject(error);
          else{
            resolve(body);
          }

        });
      });
      this.success({redirect:'/scgs/show'});
    }
    else{
      let result = await new Promise((resolve, reject)=>{
        httpClient.get('http://wsbs.sc-n-tax.gov.cn/', (error, response, body)=>{
          if(error)reject(error);
          else{
            resolve(body);
          }
        });
      });
      this.assign({
        result
      })
      return this.display();
    }
  }

  async captchaAction(){
    let token = await this.session('token');
    if(!token){
      token = uuid.v4();
      this.session('token', token);
    }
    let httpClient = getOrCreateHttpClient(token);
    httpClient.get('http://wsbs.sc-n-tax.gov.cn/vcode').pipe(this.http.res);
  }

  async showAction(){
    let token = await this.session('token');
    if(!token){
      token = uuid.v4();
      this.session('token', token);
    }
    let httpClient = getOrCreateHttpClient(token);
    let dataList = [];
    for(let i = 1; i <= 100; i++){
      let list = await getJKPZ(httpClient, i);
      if(!_.size(list[0])) break;
      dataList.push(...list);
    }
    this.assign({dataList});
    return this.display();
  }
}
