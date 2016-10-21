'use strict';

import Base from './sysbase.js';
import crypto from 'crypto';
import moment from 'moment';
import cheerio from 'cheerio';

export default class extends Base {

  async indexAction(){

    let httpClient = await this.getOrCreateHttpClient();
    if(this.isAjax()){
      let { username:nsrsbh, password:nsrpwd } = this.param();
      let sha1 = crypto.createHash('sha1');
      sha1.update(nsrpwd);
      nsrpwd = sha1.digest('hex');
      let data = {
        nsrsbh, nsrpwd, tagger:'',redirectURL:'',time:moment().format('YYYY-MM-DD HH:mm:ss')
      }

      let result = await new Promise((resolve, reject)=>{
        httpClient.post('http://dzswj.szgs.gov.cn/api/auth/clientWt', {
          body: JSON.stringify(data),
          headers: {
            'Content-Type':'application/json; charset=UTF-8',
            'x-form-id':'mobile-signin-form'
          }
        }, (error, response, body)=>{
          if(error) reject(error);
          else{
            body = JSON.parse(body);
            body.success ? resolve(body) : reject(body);
          }
        })
      });
      await this.session('szgs', {
        nsrsbh: result.data.nsrsbh
      });
      this.success({redirect:'/szgs/show'});
    }
    else{
      let result = await new Promise((resolve, reject)=>{
        httpClient.get('http://dzswj.szgs.gov.cn/BsfwtWeb/apps/views/login/login.html', (error, response, body)=>{
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

  async showAction(){
    let httpClient = await this.getOrCreateHttpClient();

    let { nsrsbh } = await this.session('szgs');
    let result = await new Promise((resolve, reject)=>{
      httpClient.post('http://dzswj.szgs.gov.cn/gzcx/gzcxAction_queryNsrxxBynsrsbh.do', {form:{
        nsrsbh
      }},(error, response, body)=>{
        if(error) reject(error);
        else{
          body = JSON.parse(body);
          body.success ? resolve(body) : reject(body);
        }
      })
    });
    let info = result.data[0];
    this.assign({info});
    return this.display();
  }
}
