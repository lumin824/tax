'use strict';

import fs from 'fs';
import request from 'request';
import FileCookieStore from 'tough-cookie-filestore';
import uuid from 'node-uuid';
import cheerio from 'cheerio';
import _ from 'lodash';


import DbCookieStore from '../ext/dbcookiestore';


export default class extends think.controller.base {

  async getOrCreateHttpClient(){
    let token = await this.session('token');
    if(!token){
      token = uuid.v4();
      this.session('token', token);
    }

    let cookiePath = think.RUNTIME_PATH + `/scgs_cookie_${token}.json`;
    if(!fs.existsSync(cookiePath)){
      fs.writeFileSync(cookiePath, '');
    }
    let jar = request.jar(new FileCookieStore(cookiePath));
    // let store = new DbCookieStore(this);
    // let jar = request.jar(store);
    return request.defaults({jar});
  }

  async httpPost(...args){
    if(!this.httpClient) this.httpClient = this.getOrCreateHttpClient();
    return new Promise((resolve, reject)=>{
      this.httpClient.post(...args, (error, response, body)=>{
        if(error) reject(error);
        else resolve({response, body});
      });
    });
  }

  async httpGet(...args){
    if(!this.httpClient) this.httpClient = await this.getOrCreateHttpClient();
    return new Promise((resolve, reject)=>{
      this.httpClient.get(...args, (error, response, body)=>{
        if(error) reject(error);
        else resolve({response, body});
      });
    });
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

    let cc = (await fetchFunc('1')).result.results[0];
    console.log(cc);
    let result = await new Promise((resolve, reject)=>{
      request.get('http://www.creditchina.gov.cn/credit_info_detail', {
        qs: { objectType:cc.objectType, encryStr:cc.encryStr},
        headers: { 'User-Agent':'request' }
      }, (error, response, body)=>{
        //console.log(body);
        if(error) reject(error);
        else{
          let $ = cheerio.load(body);

          let infos = _.map($('div.creditsearch-tagsinfo').toArray(),
            o=>_.map($(o).find('ul.creditsearch-tagsinfo-ul').toArray(),
              o2=>_.map($(o2).find('li.oneline').toArray(),
                o3=>_.trim($(o3).text())
              )
            )
          );
          let oneline = $('li.oneline').map((o,v)=>$(v).text());
          resolve({
            body,
            infos
          })
        }resolve(body);
      });
    });

    let jcxx = _.map(result.infos[0],o=>{
      let zczj = _.find(o,o2=>_.startsWith(o2,'注册资金'));
      let m = zczj.match(/(\d+(?:\.\d+)?)(千|万|十万|百万|千万|亿)?/);
      zczj = 0;
      if(m){
        zczj = parseFloat(m[1]);
        if(m[2]=='千')        zczj*=1e3;
        else if(m[2]=='万')   zczj*=1e4;
        else if(m[2]=='十万') zczj*=1e5;
        else if(m[2]=='百万') zczj*=1e6;
        else if(m[2]=='千万') zczj*=1e7;
        else if(m[2]=='亿')   zczj*=1e8;
      }
      return { zczj};
    })[0];

    return {
      jcxx
    };
  }
}
