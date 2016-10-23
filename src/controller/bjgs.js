'use strict';

import Base from './sysbase.js';
import cheerio from 'cheerio';
import iconv from 'iconv-lite';

export default class extends Base {
  async indexAction(){
    let httpClient = await this.getOrCreateHttpClient();
    if(this.isAjax()){
      let form = this.param();

      let sessionId = await new Promise((resolve, reject)=>{
        httpClient.post('http://www.bjsat.gov.cn/WSBST/bsdt/login/GetSessionId.jsp',{form:{test:1}}, (error, response, body)=>{
          if(error)reject(error);
          else{
            let $ = cheerio.load(body);
            resolve($('sessionId').text());
          }


        })
      });
      form.sessionId = sessionId;
      let result = await new Promise((resolve, reject)=>{
        httpClient.post('http://www.bjsat.gov.cn/WSBST/bsdt/BJCALogin', {form}, (error, response, body)=>{
          console.log(body);
          if(error)reject(error);
          else{
            let $ = cheerio.load(body);
            resolve({
              pr: $('pr').text(),
              ex: $('ex').text()
            });
          }

        });
      });
      if(result.pr == '1'){
        await this.session('bjgs_session', sessionId);
        return this.success({redirect:'/bjgs/show'})
      }else{
        this.fail(result.ex);
      }

    }
    else{
      let result = await new Promise((resolve, reject)=>{
        httpClient.get('http://www.bjsat.gov.cn/WSBST/bsdt/login/login.jsp', (error, response, body)=>{
          if(error)reject(error);
          else{
            let strServerSignedData = body.match(/strServerSignedData\s*=\s*"(\S+)"/)[1];
            let strServerRan = body.match(/strServerRan\s*=\s*"(\S+)"/)[1];
            let strServerCert = body.match(/strServerCert\s*=\s*"(\S+)"/)[1];
            let strRandom = body.match(/strRandom\s*=\s*"(\S+)"/)[1];

            resolve({strServerSignedData,strServerRan,strServerCert,strRandom});
          }
        });
      });
      this.assign({
        ...result
      })
      return this.display();
    }
  }

  async showAction(){
    let sessionId = await this.session('bjgs_session');
    let httpClient = await this.getOrCreateHttpClient();

    let info = await new Promise((resolve, reject)=>{
      httpClient.get('http://www.bjsat.gov.cn/WSBST/GetJbxxAction', {qs:{sessionId},encoding:null}, (error, response, body)=>{
        if(error)reject(error);
        else{
          let $ = cheerio.load(iconv.decode(body,'gb2312'));
          let tds = $('td');
          resolve({
            nsrmc: tds.eq(3).text().split('：')[1],
            nsrsbh: tds.eq(4).text().split('：')[1],
          })
        }
      });
    });
    this.assign({info});
    return this.display();
  }
}
